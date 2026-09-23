# Local dry-run fallback

`the-sleepers-waking.mp3` here is a silent local file used only when Blob is unset (`MASTER_DRY_RUN`). Production serves the real master from private Blob at `masters/the-sleepers-waking.mp3`.

```bash
npm run masters:upload -- /path/to/real-master.mp3 the-sleepers-waking
```
