#!/usr/bin/env python3
"""
Per-file audio features for the mood Auto Mix (driven by scripts/analyze-tracks.mjs).

    python3 scripts/analyze_tracks.py <slug>=<path.mp3> [<slug>=<path.mp3> ...]

Prints one JSON object per line: {"slug": ..., ...raw features...} or
{"slug": ..., "error": "..."}. Everything catalogue-relative (energy and
brightness normalisation, mood) happens in scripts/track-analysis-core.mjs, so
this file only measures one track at a time.

Needs numpy + librosa. Uses essentia (RhythmExtractor2013, KeyExtractor) when
it imports; otherwise falls back to librosa beat tracking and a
Krumhansl-Schmuckler key estimate. `analyzer` in the output says which ran.
"""
import json
import sys
import warnings

import numpy as np

warnings.filterwarnings("ignore")

# librosa (numba) must load before essentia: the other order segfaults inside
# numba's gufuncs (seen with essentia 2.1b6 + numba 0.6x on Linux).
import librosa  # noqa: E402

try:
    import essentia  # noqa: F401
    import essentia.standard as es

    essentia.log.infoActive = False
    essentia.log.warningActive = False
    HAVE_ESSENTIA = True
except Exception:  # pragma: no cover - optional dependency
    HAVE_ESSENTIA = False

SR = 44100
PITCHES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
ENHARMONIC = {"Db": "C#", "D#": "Eb", "Gb": "F#", "G#": "Ab", "A#": "Bb"}

# Krumhansl-Kessler profiles (fallback key finder only).
KK_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KK_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def ks_key(y, sr):
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1)
    best = (-2.0, "C", "major")
    for i in range(12):
        for prof, mode in ((KK_MAJOR, "major"), (KK_MINOR, "minor")):
            r = np.corrcoef(chroma, np.roll(prof, i))[0, 1]
            if r > best[0]:
                best = (float(r), PITCHES[i], mode)
    return best[1], best[2], best[0]


def first_downbeat(beats, onset_env, sr, hop, y_low_rms, rms_hop):
    """Pick the beat phase (0-3) whose beats carry the most low-end + onset
    energy: a kick/bass hit usually lands on beat 1 of the bar."""
    if len(beats) < 8:
        return float(beats[0]) if len(beats) else 0.0, 0
    scores = []
    for phase in range(4):
        b = beats[phase::4]
        of = np.clip((b * sr / hop).astype(int), 0, len(onset_env) - 1)
        lf = np.clip((b * sr / rms_hop).astype(int), 0, len(y_low_rms) - 1)
        on = onset_env[of] / (onset_env.max() + 1e-9)
        lo = y_low_rms[lf] / (y_low_rms.max() + 1e-9)
        scores.append(float(np.mean(on) + np.mean(lo)))
    phase = int(np.argmax(scores))
    return float(beats[phase]), phase


def analyse(path):
    y, sr = librosa.load(path, sr=SR, mono=True)
    duration = len(y) / sr
    out = {"duration": round(duration, 2)}

    # --- tempo + beats
    librosa_bpm, lb = librosa.beat.beat_track(y=y, sr=sr, units="time")
    librosa_bpm = float(np.atleast_1d(librosa_bpm)[0])
    if HAVE_ESSENTIA:
        rhythm = es.RhythmExtractor2013(method="multifeature")
        bpm, beats, conf, _, _ = rhythm(y.astype(np.float32))
        bpm, beats, conf = float(bpm), np.asarray(beats, dtype=float), float(conf)
        out["analyzer"] = "essentia+librosa"
    else:
        bpm, beats, conf = librosa_bpm, np.asarray(lb, dtype=float), None
        out["analyzer"] = "librosa"
    out["bpm_raw"] = round(bpm, 2)
    out["bpm_librosa"] = round(librosa_bpm, 2)
    out["beat_confidence"] = None if conf is None else round(conf, 2)

    # Tempo steadiness: median |inter-beat interval - median interval| in ms.
    if len(beats) > 8:
        ibi = np.diff(beats)
        out["ibi_jitter_ms"] = round(float(np.median(np.abs(ibi - np.median(ibi)))) * 1000, 1)
    else:
        out["ibi_jitter_ms"] = None

    # --- key
    if HAVE_ESSENTIA:
        key, scale, strength = es.KeyExtractor(profileType="edma", sampleRate=SR)(y.astype(np.float32))
        key = ENHARMONIC.get(key, key)
        out["key_strength"] = round(float(strength), 2)
    else:
        key, scale, strength = ks_key(y, sr)
        out["key_strength"] = round(strength, 2)
    out["key"] = key
    out["mode"] = scale

    # --- loudness / energy / brightness (raw; normalised catalogue-wide later)
    hop = 512
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    rms_db = librosa.amplitude_to_db(rms, ref=1.0)
    voiced = rms_db > (rms_db.max() - 40)  # ignore silence / fade tails
    out["rms_db"] = round(float(np.mean(rms_db[voiced])), 2)
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
    flux = np.sqrt(np.mean(np.diff(S, axis=1).clip(min=0) ** 2, axis=0))
    out["spectral_flux"] = round(float(np.mean(flux[voiced[1:]])), 4)
    centroid = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
    rolloff = librosa.feature.spectral_rolloff(S=S, sr=sr, roll_percent=0.85)[0]
    out["centroid_hz"] = round(float(np.mean(centroid[voiced])), 1)
    out["rolloff_hz"] = round(float(np.mean(rolloff[voiced])), 1)
    onset_env = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S, ref=np.max), sr=sr)
    out["onset_rate"] = round(float(len(librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)) / duration), 3)

    # Low-band (< ~150 Hz) energy for downbeat phase.
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    low = S[freqs < 150].sum(axis=0)
    db, phase = first_downbeat(beats, onset_env, sr, hop, low, hop)
    out["first_downbeat"] = round(db, 3)

    # Last audible moment (RMS within 40 dB of peak) for outro placement.
    last_frame = int(np.nonzero(voiced)[0][-1]) if voiced.any() else len(rms) - 1
    out["audio_end"] = round(float(librosa.frames_to_time(last_frame, sr=sr, hop_length=hop)), 2)
    out["beat_count"] = int(len(beats))

    # Outro for an 8-16 bar crossfade, on a detected downbeat: 16 bars when they
    # fit in the last 25% of the audible track, else 8. Bar length comes from the
    # detected beats (median inter-beat interval), so drift does not matter.
    downbeats = beats[phase::4] if len(beats) else np.array([])
    if len(downbeats) > 2:
        bar_sec = 4 * float(np.median(np.diff(beats)))
        end = out["audio_end"]
        bars = 16 if 16 * bar_sec <= 0.25 * end else 8
        cands = downbeats[downbeats <= end - bars * bar_sec + 0.05]
        if len(cands):
            out["outro_start"] = round(float(cands[-1]), 2)
            out["outro_bars"] = bars
            out["bar_seconds"] = round(bar_sec, 3)
    return out


def main(argv):
    for item in argv:
        slug, _, path = item.partition("=")
        try:
            rec = analyse(path)
            rec["slug"] = slug
        except Exception as exc:  # report and continue
            rec = {"slug": slug, "error": f"{type(exc).__name__}: {exc}"}
        print(json.dumps(rec), flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
