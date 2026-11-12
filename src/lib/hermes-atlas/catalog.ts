import { EDGES } from "./edges.ts";
import { ENTRIES } from "./entries.ts";
import { REFS } from "./refs.ts";
import type { Edge, Entry, Period, ReadingPanel, Tour } from "./types.ts";

export const CORE_NAMES = [
  "idris",
  "mercury",
  "trismegistus",
  "thoth",
  "enoch"
] as const;
export const GROUPS = [
  "Greek",
  "Roman & Etruscan",
  "Egyptian",
  "Hermetic & Hellenistic",
  "Islamic",
  "Jewish & Christian",
  "Mesopotamian",
  "Germanic & Celtic",
  "Hindu & Indian",
  "Planet & Calendar",
  "Renaissance & Modern",
  "Yoruba & Diaspora",
  "Indigenous Americas",
  "Bahá'í",
  "Chinese reception"
] as const;
export const EDGE_TYPES = [
  "Greco-Roman equivalent",
  "Syncretism",
  "Ancient comparison",
  "Myth & ritual",
  "Parallel only",
  "Planet & calendar",
  "Traditional identification",
  "Text & transmission",
  "Modern reception"
] as const;
export const PERIODS: Period[] = [
  {
    "name": "Early Egypt",
    "range": [
      -3100,
      -2000
    ],
    "label": "c. 3000–2000 BCE",
    "note": "Early roots of Thoth, Seshat and funerary religion; precise first attestations vary."
  },
  {
    "name": "Bronze Age",
    "range": [
      -1999,
      -800
    ],
    "label": "2000–800 BCE",
    "note": "Nabû and Mycenaean evidence for Hermes; these are attestations, not divine birthdays."
  },
  {
    "name": "Classical worlds",
    "range": [
      -799,
      -1
    ],
    "label": "800–1 BCE",
    "note": "Greek stories, Roman and Etruscan equivalents, Enochic literature and Hellenistic reinterpretation."
  },
  {
    "name": "Late antiquity",
    "range": [
      1,
      599
    ],
    "label": "1–599 CE",
    "note": "Philosophical Hermetica, composite deities and Jewish and Christian receptions."
  },
  {
    "name": "Arabic transmission",
    "range": [
      600,
      1299
    ],
    "label": "600–1299 CE",
    "note": "Qur'anic Idris, Arabic Hermetica, the three Hermeses and Illuminationist wisdom."
  },
  {
    "name": "Renaissance",
    "range": [
      1300,
      1599
    ],
    "label": "1300–1599 CE",
    "note": "Ficino's 1463 translation, Pico, Bruno and alchemical medicine."
  },
  {
    "name": "Critical & esoteric",
    "range": [
      1600,
      1799
    ],
    "label": "1600–1799 CE",
    "note": "Casaubon's 1614 dating, Rosicrucian manifestos and modern organised Freemasonry."
  },
  {
    "name": "Modern reception",
    "range": [
      1800,
      2026
    ],
    "label": "1800 CE onward",
    "note": "Bahá'í reception, the 1908 Kybalion and Jung's psychological reading."
  }
];
export const MODERN_IDS = new Set([
  "jung",
  "golden-dawn",
  "thoth-tarot",
  "tarot-egypt",
  "doreal",
  "kybalion",
  "bonacci",
  "hermetic-degrees",
  "mathers",
  "westcott",
  "farr",
  "fortune",
  "crowley-thelema",
  "regardie",
  "blavatsky",
  "kingsford",
  "hall",
  "luxor",
  "schwaller",
  "new-age",
  "atkinson",
  "mead"
]);
export const TRADITION_IDS = new Set([
  "idris",
  "enoch",
  "metatron",
  "gabriel",
  "abumashar",
  "harran",
  "fuxi",
  "prisca",
  "correggio",
  "loki",
  "eshu",
  "elegua",
  "coyote"
]);
export const EVIDENCE_LAYERS = [
  "Attested history",
  "Tradition / identification",
  "Modern interpretation / fringe"
] as const;
export const TRADITION_NAMES = [
  "Egyptian",
  "Greek",
  "Roman / Etruscan",
  "Jewish",
  "Christian",
  "Islamic",
  "Hermetic",
  "Gnostic crossovers",
  "Alchemical",
  "Renaissance",
  "Rosicrucian / Masonic",
  "Modern occult",
  "Norse / Celtic",
  "Comparative",
  "Mesopotamian",
  "Mesopotamian roots",
  "Yoruba / Afro-Cuban",
  "Bahá'í"
] as const;
export const TOPIC_IDS: Record<string, readonly string[]> = {
  "Renaissance": [
    "yates"
  ],
  "Jewish": [
    "enoch",
    "moses",
    "metatron",
    "artapanus",
    "cabala"
  ],
  "Christian": [
    "enoch",
    "moses",
    "gabriel",
    "lactantius",
    "augustine",
    "psellus",
    "twenty-four",
    "ficino",
    "pico",
    "lazzarelli",
    "patrizi",
    "kircher",
    "pymander",
    "kingsford"
  ],
  "Gnostic crossovers": [
    "gnostic-crossovers",
    "nag-hammadi",
    "eighth-ninth",
    "thanksgiving",
    "poimandres",
    "rebirth",
    "zosimos"
  ],
  "Alchemical": [
    "alchemy",
    "emerald",
    "balinas",
    "sirr-khaliqa",
    "jabir",
    "zosimos",
    "paracelsus",
    "tria-prima",
    "rosarium",
    "hermetic-vessel",
    "newton",
    "jung",
    "chymical-wedding",
    "maier",
    "atalanta",
    "caduceus",
    "neidan"
  ],
  "Rosicrucian / Masonic": [
    "rosicrucians",
    "fama",
    "confessio",
    "chymical-wedding",
    "maier",
    "atalanta",
    "freemasonry",
    "cooke",
    "hermetic-degrees",
    "fludd"
  ],
  "Comparative": [
    "loki",
    "eshu",
    "elegua",
    "coyote",
    "fuxi",
    "budha",
    "neidan",
    "buni",
    "letter-circle",
    "gnostic-crossovers",
    "ptah-logos",
    "nabu"
  ],
  "Mesopotamian roots": [
    "enki",
    "nisaba",
    "nabu",
    "ningishzida",
    "adapa",
    "apkallu",
    "oannes",
    "enmeduranki"
  ]
};
export const TOURS: Tour[] = [
  {
    "title": "The long journey · Thoth to the Golden Dawn",
    "note": "A guided sequence of contacts and receptions, not an unbroken institutional lineage.",
    "ids": [
      "thoth",
      "hermes",
      "trismegistus",
      "idris",
      "abumashar",
      "arabic-hermetica",
      "sirr-khaliqa",
      "ficino",
      "golden-dawn"
    ]
  },
  {
    "title": "Enter the revelation",
    "note": "Read vision, participation, synthesis and rebirth as distinct Hermetic teachings.",
    "ids": [
      "poimandres",
      "krater",
      "key",
      "rebirth",
      "eighth-ninth",
      "thanksgiving"
    ]
  },
  {
    "title": "The teacher's circle and the golden chain",
    "note": "Literary interlocutors first; Renaissance lineage theories second.",
    "ids": [
      "trismegistus",
      "tat",
      "asclepius-pupil",
      "ammon",
      "prisca",
      "lazzarelli",
      "agrippa"
    ]
  },
  {
    "title": "Arabic sciences and letters",
    "note": "Follow texts and attributed authorities; comparisons are explicitly qualified.",
    "ids": [
      "idris",
      "harran",
      "picatrix",
      "perfect-nature",
      "letter-circle",
      "buni",
      "suhrawardi"
    ]
  },
  {
    "title": "The alchemical work",
    "note": "Compare material principles, emblematic narratives and psychological reception.",
    "ids": [
      "sirr-khaliqa",
      "emerald",
      "tria-prima",
      "hermetic-vessel",
      "rosarium",
      "chymical-wedding",
      "atalanta",
      "jung"
    ]
  },
  {
    "title": "Renaissance, printing and criticism",
    "note": "Patronage, translation and philology change the authority of Hermes.",
    "ids": [
      "psellus",
      "cosimo",
      "ficino",
      "pico",
      "lazzarelli",
      "patrizi",
      "bruno",
      "casaubon",
      "yates"
    ]
  },
  {
    "title": "Modern occult families",
    "note": "Documented people and books, not proof of their remote-lineage claims.",
    "ids": [
      "kingsford",
      "luxor",
      "blavatsky",
      "mead",
      "westcott",
      "farr",
      "crowley-thelema",
      "fortune",
      "atkinson",
      "bonacci"
    ]
  },
  {
    "title": "Mercury beyond Rome",
    "note": "Read Roman interpretive names against local evidence and native-name uncertainty.",
    "ids": [
      "mercury",
      "caesar",
      "lugus",
      "rosmerta",
      "uley",
      "tacitus",
      "odin",
      "wednesday"
    ]
  },
  {
    "title": "Mesopotamian roots · scribes, sages and comparisons",
    "note": "Attested Mesopotamian figures first. Hellenistic and scholarly identifications are labelled as comparisons; modern esoteric equations of Enki or the apkallu with Hermes are later claims.",
    "ids": [
      "enki",
      "nisaba",
      "nabu",
      "ningishzida",
      "adapa",
      "apkallu",
      "oannes",
      "enmeduranki"
    ]
  }
];
export const READINGS: Record<string, ReadingPanel> = {
  "ficino": {
    "heading": "Ficino, Cosimo and a manuscript becoming print",
    "intro": "The dates belong to identifiable acts of patronage, translation and printing. They do not date the original composition of the Greek works to the Renaissance or confirm the ancient chronology Ficino believed.",
    "columns": [
      "Stage",
      "What happened",
      "What it does not establish"
    ],
    "rows": [
      [
        "Greek manuscript",
        "A manuscript of fourteen tractates reached Cosimo's circle from the Byzantine Greek world around 1460.",
        "Not a newly excavated prehistoric Egyptian book."
      ],
      [
        "1463 translation",
        "Ficino completed the Latin translation for Cosimo, ahead of his larger Plato project.",
        "Not a translation of every work now called Hermetic."
      ],
      [
        "1471 printing",
        "The Pimander appeared in print at Treviso, bringing manuscript learning to a wider public.",
        "The title Poimandres could name the whole translated collection, not only CH I."
      ],
      [
        "Christian ancient theology",
        "Ficino situated Hermes within a chain of wisdom compatible with Christianity.",
        "A historically influential belief, not proof of a securely dated pre-Mosaic author."
      ]
    ],
    "refs": [
      "faivre",
      "hanegraaff",
      "cam"
    ]
  },
  "pico": {
    "heading": "Pico's 900 Theses and the undelivered Oration",
    "intro": "Pico's concord is a Renaissance project to be studied, not evidence that all of the traditions he cited originally taught one secret doctrine.",
    "columns": [
      "Work / event",
      "Content or context",
      "Evidence boundary"
    ],
    "rows": [
      [
        "900 Conclusions · 1486",
        "A printed programme proposing debate across philosophical and theological authorities, including magical and Cabalistic materials.",
        "The intended disputation did not take place; a programme is not a transcript of a completed council."
      ],
      [
        "Oration · 1486 composition",
        "The planned introductory speech invokes the Asclepius's great wonder of humanity.",
        "The famous Oration on the Dignity of Man was not delivered as planned; its later title and reception shape how it is now read."
      ],
      [
        "Ecclesiastical objections",
        "The project encountered examination and condemnation, limiting the proposed public debate.",
        "Its controversy should not be reduced to one forbidden Hermetic sentence."
      ],
      [
        "Christian Cabala",
        "Pico reads Jewish mystical material through his Christian synthesis.",
        "This is not equivalent to all Jewish Kabbalah or proof that Kabbalah derives from Hermes."
      ]
    ],
    "refs": [
      "faivre",
      "cam",
      "ht"
    ]
  },
  "casaubon": {
    "heading": "1614 · dating the texts, not abolishing their history",
    "intro": "Casaubon's philology damaged the pre-Mosaic authorship claim. Modern scholarship refines the dating and takes Egyptian religious contexts more seriously than a simple ancient-wisdom-versus-forgery story allows.",
    "columns": [
      "Distinction",
      "What follows",
      "What does not follow"
    ],
    "rows": [
      [
        "Composition versus claimed speaker",
        "The Greek philosophical works belong to the early imperial world, not a recovered pre-Mosaic author's library.",
        "That every technical Hermetic text has the same date or author."
      ],
      [
        "Collection versus individual works",
        "Different tractates and witnesses have their own histories; the collection is later than many of its contents.",
        "That one argument dates every passage precisely."
      ],
      [
        "Greek and Egyptian settings",
        "Greek philosophical vocabulary coexists with Egyptian religious and scribal contexts.",
        "That a late date proves there is no Egyptian contribution."
      ],
      [
        "Reception after criticism",
        "Fludd, alchemical writers and later occult readers continue to use Hermes.",
        "That Hermeticism ended overnight in 1614."
      ],
      [
        "Earlier doubts and later debates",
        "Other early modern critics had also questioned chronology; modern historians reassess the story.",
        "That the entire history of criticism consists of one heroic discovery."
      ]
    ],
    "refs": [
      "faivre",
      "hermetica",
      "hanegraaff"
    ]
  },
  "kybalion": {
    "heading": "1908 · the seven principles in their modern setting",
    "intro": "The title-page author is Three Initiates. William Walker Atkinson is commonly proposed as the principal writer, but attribution is not a recovered ancient authorship record. The following is the book's modern scheme, not seven chapter headings from the Corpus Hermeticum.",
    "columns": [
      "Principle",
      "What the Kybalion proposes",
      "How to read the claim"
    ],
    "rows": [
      [
        "Mentalism",
        "Reality is fundamentally mental.",
        "A modern metaphysical proposition; compare ancient Nous without treating them as identical."
      ],
      [
        "Correspondence",
        "Patterns relate higher and lower levels.",
        "Draws on familiar Hermetic language but broadens its use."
      ],
      [
        "Vibration",
        "Everything moves or vibrates.",
        "Its metaphysical language is not established physics merely because physics also uses frequency."
      ],
      [
        "Polarity",
        "Opposites are different degrees of the same thing.",
        "A generalising interpretive rule, not a demonstrated law for every moral or physical distinction."
      ],
      [
        "Rhythm",
        "Processes have swings and cycles.",
        "Not evidence that all history or personal life is governed by a hidden universal pendulum."
      ],
      [
        "Cause and effect",
        "Events participate in causal law rather than pure chance.",
        "Its occult interpretation is not a substitute for scientific causal investigation."
      ],
      [
        "Gender",
        "Masculine and feminine principles are posited across levels of reality.",
        "A symbolic modern framework, not an authoritative account of anatomy, sex or gender identity."
      ]
    ],
    "refs": [
      "kyb",
      "atkinson",
      "faivre"
    ]
  },
  "book-thoth": {
    "heading": "Which Book of Thoth? · five different claims",
    "intro": "A shared title is not a shared manuscript. Distinguishing literary objects, surviving Egyptian texts and modern occult books prevents a particularly common confusion.",
    "columns": [
      "Object / work",
      "Evidence",
      "Relationship"
    ],
    "rows": [
      [
        "Setne's dangerous book",
        "A magical book inside an ancient Egyptian story.",
        "The tale's supernatural book is a narrative object, not a recovered universal library."
      ],
      [
        "Demotic Book of Thoth",
        "Fragmentary Egyptian scribal dialogue studied in modern editions.",
        "A real surviving text, distinct from the Setne story's object."
      ],
      [
        "Clement's forty-two books",
        "An ancient author's report of Egyptian sacred learning.",
        "Not forty-two recovered volumes identical to the Corpus Hermeticum."
      ],
      [
        "Tarot's Book of Thoth",
        "An eighteenth-century Egyptian-origin theory and later occult tarot systems.",
        "Tarot has a documented European card-game history; Crowley's 1944 book is modern."
      ],
      [
        "Doreal's plural Emerald Tablets",
        "A separate twentieth-century work claiming Atlantean-Egyptian authority.",
        "No authenticated ancient tablets establish its claimed provenance; it is not the short medieval Emerald Tablet."
      ]
    ],
    "refs": [
      "thothbook",
      "clement",
      "tarot",
      "crowley",
      "doreal"
    ]
  },
  "definitions": {
    "heading": "Armenian Definitions · a different kind of witness",
    "intro": "Armenian describes the surviving translation, not the original cultural origin of every saying. Dating an underlying Greek layer remains a scholarly reconstruction.",
    "columns": [
      "Feature",
      "What it adds",
      "Distinction"
    ],
    "rows": [
      [
        "Aphoristic teaching",
        "Short statements on divine reality, mind, soul and perception rather than one long revelation narrative.",
        "Not the same literary form as Poimandres."
      ],
      [
        "Translation witness",
        "A sixth-century Armenian translation preserves the work more fully than the Greek remains.",
        "Its translation date is not necessarily its composition date."
      ],
      [
        "Earlier materials?",
        "Parallels with independent Greek Hermetica support Mahe's argument for an early underlying collection.",
        "A possible first-century layer is not a securely dated first-century publication."
      ],
      [
        "Not CH XVI",
        "The Corpus also contains a work called Definitions of Asclepius to Ammon.",
        "Similar titles must not collapse two distinct textual traditions."
      ]
    ],
    "refs": [
      "hermetica",
      "litwa",
      "hanegraaff"
    ]
  },
  "stobaeus": {
    "heading": "Stobaei Hermetica · the anthology as an archive",
    "intro": "Stobaeus assembled excerpts within an enormous educational anthology in the fifth century. Survival by quotation means both preservation and loss of the original surrounding context.",
    "columns": [
      "Strand",
      "What survives",
      "Reading caution"
    ],
    "rows": [
      [
        "Twenty-nine excerpts in Litwa's edition",
        "Teachings organised under subjects such as God, fate, time, matter, soul and truth.",
        "A modern editorial count is not a claim that Stobaeus possessed twenty-nine complete Hermetic books."
      ],
      [
        "Kore Kosmou",
        "A long Isis–Horus teaching on cosmic order and souls.",
        "The title has competing translations, including Maiden and Pupil of the World's Eye."
      ],
      [
        "Philosophical and technical overlap",
        "Some material bridges the modern categories of theoretical and practical Hermetica.",
        "Those categories are useful but not an absolute ancient institutional division."
      ],
      [
        "Victorian Virgin of the World",
        "Kingsford and Maitland bring the Isis–Horus material to new readers in 1885.",
        "Their interpretive setting is modern Christian esotericism, not neutral access to an unchanging Egyptian school."
      ]
    ],
    "refs": [
      "litwa",
      "kore",
      "hermetica",
      "kingsford",
      "faivre"
    ]
  },
  "poimandres": {
    "heading": "The Poimandres revelation · CH I",
    "intro": "A narrative of revelation and transformation, not a neutral astronomy textbook. The anonymous narrator is conventionally associated with Hermes, but the opening does not supply a recoverable historical biography.",
    "columns": [
      "Movement",
      "What happens",
      "Evidence boundary"
    ],
    "rows": [
      [
        "Withdrawal and encounter",
        "Ordinary sensation recedes; a vast being asks what the narrator desires to know and identifies as Mind.",
        "A literary account of visionary knowledge, not independently verified contact."
      ],
      [
        "Light, darkness and ordering",
        "The vision unfolds creation through light, word, nature and cosmic powers.",
        "Compare Greek philosophical and Egyptian settings without forcing every term into a later system."
      ],
      [
        "Human double condition",
        "Divine-origin humanity becomes entangled with nature and mortality.",
        "This is the treatise's sacred anthropology, not evolutionary biology."
      ],
      [
        "Ascent and praise",
        "The soul relinquishes the spheres' effects and joins higher praise; the recipient becomes a herald of the teaching.",
        "Seven spheres and higher realms belong to ancient cosmology, not a modern flight itinerary."
      ]
    ],
    "refs": [
      "chtexts",
      "hanegraaff",
      "hermetica"
    ]
  },
  "corpus": {
    "heading": "Reading all seventeen tractates",
    "intro": "The conventional numbering runs I–XIV and XVI–XVIII: there is no missing ancient CH XV to recover. Early editorial material once occupied that slot. Dates for individual treatises remain approximate; a 200 CE map anchor does not mean simultaneous composition.",
    "columns": [
      "Tractates",
      "Focus",
      "Read with"
    ],
    "rows": [
      [
        "I · Poimandres",
        "Revelation, creation, humanity and ascent.",
        "XI, XIII and the Eighth and Ninth."
      ],
      [
        "II–III",
        "Motion and the incorporeal; a sacred creation discourse.",
        "Different literary forms, not one continuous argument."
      ],
      [
        "IV–VII",
        "Mind's mixing bowl; visible works; the Good; escape from ignorance.",
        "Ethical response and contemplative knowledge."
      ],
      [
        "VIII–XII",
        "Change, thought and sense, the Key, Mind, fate and responsibility.",
        "Cosmology and philosophical psychology."
      ],
      [
        "XIII–XIV",
        "Rebirth and secret hymn; a letter to Asclepius.",
        "Pedagogy, transformation and literary transmission."
      ],
      [
        "XVI–XVIII",
        "Asclepius to Ammon; images and bodies; praise of kings.",
        "Not the Armenian Definitions and not all direct Hermes speeches."
      ]
    ],
    "refs": [
      "chtexts",
      "hermetica",
      "hanegraaff"
    ]
  },
  "asclepius-text": {
    "heading": "The Asclepius · lament, statues and reception",
    "intro": "The Perfect Discourse survives mainly in Latin, with Greek fragments and a Coptic excerpt. Its lament is a literary prophecy in its ancient setting, not a validated forecast of every later event.",
    "columns": [
      "Passage / theme",
      "Content",
      "Why the distinction matters"
    ],
    "rows": [
      [
        "Humanity as a great wonder",
        "Humanity participates in divine and earthly life.",
        "Pico invokes this language at the opening of the Oration."
      ],
      [
        "Animated statues",
        "The dialogue describes humans making divine images receptive to spiritual powers.",
        "Augustine treats this critically; not all Christian readers welcomed Hermetic ritual."
      ],
      [
        "Lament over Egypt · §§24–26",
        "Sacred Egypt is imagined abandoned, its temples and religious life overturned, followed by divine restoration.",
        "Study rhetoric, historical anxiety and reception rather than treating it as proof of supernatural prediction."
      ],
      [
        "Nag Hammadi VI,8",
        "A Coptic witness preserves material corresponding to Asclepius 21–29.",
        "The surviving collection permits comparison of translations, not an equation of all Hermetism with Gnosticism."
      ]
    ],
    "refs": [
      "asc",
      "aug",
      "nag",
      "faivre"
    ]
  },
  "emerald": {
    "heading": "Emerald Tablet · clause-by-clause reading",
    "intro": "These are editorial paraphrases of the familiar Latin recension, not a claim that every Arabic or Latin witness has identical wording or numbering. Its earliest known witness is in the Arabic Sirr al-khaliqa; Balinas's underground discovery is the story framing the text. Interpretations below are possibilities in its reception, not a universally decoded secret.",
    "columns": [
      "Clause / image",
      "Symbolic or alchemical reading",
      "Caution"
    ],
    "rows": [
      [
        "Truth without falsehood",
        "An emphatic declaration of authority invites trust.",
        "A truth claim is not external authentication."
      ],
      [
        "Above and below correspond",
        "Relations between celestial and earthly processes; later macrocosm/microcosm readings.",
        "The modern slogan as above, so below compresses a longer passage."
      ],
      [
        "All things from one, by adaptation",
        "Unity and differentiation; alchemists sought a common transformative subject.",
        "The one thing has been interpreted differently, not identified once for all."
      ],
      [
        "Sun as father, Moon as mother",
        "Complementary sources, often read through solar/lunar or alchemical polarities.",
        "Not a literal genealogy of Greek gods or a verified gland diagram."
      ],
      [
        "Wind carries; Earth nurses",
        "Generation, transport and embodiment across elemental imagery.",
        "Symbolic kinship is not a medical mechanism."
      ],
      [
        "Power or perfection of the whole",
        "The difficult Latin telesma passage evokes completion and potency.",
        "Translations differ; no single English keyword settles the doctrine."
      ],
      [
        "Separate earth from fire",
        "Discern and distinguish components or conditions in transformation.",
        "A historical operation-image, not an experiment instruction here."
      ],
      [
        "Subtle from gross, gently and carefully",
        "Refinement and discrimination rather than indiscriminate mixing.",
        "Spiritual readings are later interpretations alongside material ones."
      ],
      [
        "Ascend from earth to heaven and return",
        "Circulation unites upper and lower powers; distillation and spiritual ascent are later readings.",
        "A shared image does not prove identical practice in every tradition."
      ],
      [
        "Glory; darkness flees",
        "Completion is described as illumination or successful knowledge.",
        "Not a guarantee of enlightenment, healing or wealth."
      ],
      [
        "Strength overcomes subtle and penetrates solid",
        "The transformative subject is assigned comprehensive power.",
        "Poetic efficacy language is not experimental verification."
      ],
      [
        "Creation and marvellous adaptations",
        "The work is linked to the ordering of the world and future transformations.",
        "Natural philosophy and theological analogy intertwine."
      ],
      [
        "Hermes has three parts of wisdom",
        "The speaker claims comprehensive authority and the thrice-great title.",
        "Later three-science or three-principle schemes should not be read back as the one certain original meaning."
      ],
      [
        "The operation of the Sun is complete",
        "The familiar recension closes with solar work.",
        "Keep this short text separate from Doreal's modern plural tablets."
      ]
    ],
    "refs": [
      "hermetica",
      "emerald",
      "faivre",
      "newton"
    ]
  },
  "chymical-wedding": {
    "heading": "Seven days of the Chymical Wedding",
    "intro": "A reading guide to the literary plot, not a reconstruction of an actual 1459 rite. The 1616 publication and the story's internal date are different kinds of evidence. Interpretations vary among Christian, alchemical, literary and later psychological readers.",
    "columns": [
      "Day",
      "Narrative movement",
      "Possible reading, not fixed decoding"
    ],
    "rows": [
      [
        "1 · Invitation",
        "Rosenkreutz receives a summons and prepares for a demanding journey.",
        "Vocation, unworthiness and readiness."
      ],
      [
        "2 · Roads and gates",
        "The traveller must choose a route and pass entry conditions.",
        "Discernment and the boundaries of admission."
      ],
      [
        "3 · The balance",
        "Candidates undergo a weighing and are separated by their fitness.",
        "Testing sincerity or worth; not the Egyptian judgement scene copied unchanged."
      ],
      [
        "4 · Royal drama and death",
        "Courtly celebration and performance turn towards the deaths of royal figures.",
        "The wedding contains dissolution as well as union."
      ],
      [
        "5 · Funeral and hidden mysteries",
        "Funerary movement and forbidden discovery deepen the candidate's uncertainty.",
        "Curiosity, secrecy and the limits of knowledge."
      ],
      [
        "6 · The tower work",
        "Laboratory-like transformations involving a bird and the royal restoration unfold in the Tower of Olympus.",
        "Death, refinement and reconstitution in an alchemical narrative."
      ],
      [
        "7 · Return and obligation",
        "Knighthood and service do not erase the consequences of transgression.",
        "Initiation entails responsibility, not merely possession of power."
      ]
    ],
    "refs": [
      "wedding",
      "ros",
      "faivre"
    ]
  },
  "harran": {
    "heading": "Harran · planets, prophets and contested labels",
    "intro": "Arabic writers report Harranian reverence for Hermes and planetary religion. Their accounts are sources to analyse, not a transparent recording of an unchanged cult across millennia.",
    "columns": [
      "Thread",
      "What can be said",
      "Avoid"
    ],
    "rows": [
      [
        "Hermes as authority / prophet",
        "Medieval accounts give Hermes a role in the community's sacred history.",
        "Assuming every report gives the same doctrine or securely documents its origin."
      ],
      [
        "Planetary sanctuaries",
        "Descriptions of planetary worship belong to the city's reported learned religious setting.",
        "Inventing a complete excavated plan of seven temples from literary descriptions."
      ],
      [
        "Sabian identity",
        "The label had legal, scriptural and historical uses.",
        "Equating Harranians, Qur'anic Sabians and Mandaeans without qualification."
      ],
      [
        "Arabic reception",
        "Hermes biographies, astrology and pseudo-Aristotelian texts meet in Arabic learned literature.",
        "Turning literary connections into proof of one secret global church."
      ]
    ],
    "refs": [
      "arab",
      "prophet",
      "saif"
    ]
  },
  "picatrix": {
    "heading": "Hermes in the Picatrix and Arabic hidden sciences",
    "intro": "Hermes is one among many named authorities. The Arabic Ghāyat al-Hakim and its thirteenth-century Iberian transmission are not authored by a single ancient sage.",
    "columns": [
      "Connection",
      "Historical value",
      "Limit"
    ],
    "rows": [
      [
        "Hermetic attributions",
        "Hermes authorises parts of a larger astral-magic compilation.",
        "An attributed speech is not an authenticated recording of Hermes."
      ],
      [
        "Perfect Nature",
        "A spiritual guiding counterpart appears in related pseudo-Aristotelian Hermetic material.",
        "Do not substitute one modern higher-self definition for all medieval uses."
      ],
      [
        "Planetary correspondences",
        "Images, substances and times are connected within an astrological worldview.",
        "The page explains history, not operational spell recipes or proven efficacy."
      ],
      [
        "Textual traffic",
        "Compare Ikhwan al-Safa, pseudo-Aristotelian works and later Latin reception.",
        "Similarities should be tested through passages, manuscripts and translations."
      ]
    ],
    "refs": [
      "picatrix",
      "saif",
      "ikhwan",
      "hermetica"
    ]
  },
  "jung": {
    "heading": "The Spirit Mercurius · Jung's modern reading",
    "intro": "Jung's essay originated in the 1940s and was later collected in Alchemical Studies. His reading is a twentieth-century psychological interpretation, not the only meaning earlier alchemists assigned to Mercurius.",
    "columns": [
      "Image",
      "Jungian reading",
      "Historical boundary"
    ],
    "rows": [
      [
        "Mercurius as mediator",
        "A figure able to join opposed qualities and move between levels.",
        "Not a literal identity between the Greek god and a modern psychological model."
      ],
      [
        "Double and contradictory",
        "Spirit and matter, poison and remedy, high and low can coexist in the symbolic figure.",
        "Do not ingest mercury: liquid quicksilver is toxic."
      ],
      [
        "Rosarium's union",
        "Royal pairs and transformations become images of psychic integration.",
        "The original compilation also has material, religious and practical alchemical contexts."
      ],
      [
        "Vessel and caduceus",
        "Enclosure and opposed serpents can be read through transformation and mediation.",
        "Later readings do not replace the ancient herald's staff's attested functions."
      ]
    ],
    "refs": [
      "jungstudies",
      "rosarium",
      "jung"
    ]
  },
  "spell125": {
    "heading": "Judgement, forty-two assessors and truthful speech",
    "intro": "Book of the Dead is a modern title for diverse funerary spells and manuscripts, not one fixed Egyptian bible. Spell 125's forms and illustrations vary.",
    "columns": [
      "Element",
      "Role",
      "Do not conflate"
    ],
    "rows": [
      [
        "Declarations / negative confession",
        "The deceased denies wrongdoing before named divine assessors.",
        "Not a list copied from the Kybalion's seven principles."
      ],
      [
        "Forty-two assessors",
        "A divine tribunal contextualises right conduct and ritual knowledge.",
        "Not Clement's forty-two priestly books; a shared number is not identity."
      ],
      [
        "Heart and feather",
        "The heart is tested against Ma'at's truth/order.",
        "The scene is not a modern anatomical or psychological experiment."
      ],
      [
        "Anubis and Thoth",
        "Anubis tends the weighing; Thoth records or announces its result.",
        "Thoth is not simply doing every funerary job; Greek psychopomp is a different role."
      ],
      [
        "Passage and vindication",
        "Correct speech, knowledge and ethical presentation support the deceased's desired afterlife.",
        "Attestation of the ritual does not prove its supernatural outcome."
      ]
    ],
    "refs": [
      "spell125",
      "t",
      "maat",
      "anubis"
    ]
  },
  "enki": {
    "heading": "Mesopotamian roots",
    "intro": "These names belong to Mesopotamian religion, sage lists and Greek report. Hellenistic identifications and modern scholarly comparisons are labelled as such. Modern esoteric equations with Hermes are later claims, not cuneiform evidence.",
    "columns": [
      "Thread",
      "What can be said",
      "Avoid"
    ],
    "rows": [
      [
        "Enki / Ea and the sages",
        "Enki of Eridu is the god of wisdom, crafts and magic; Ea is the Akkadian name. Myths attach Adapa and the apkallu to his teaching.",
        "Treating a modern Enki = Hermes claim as an ancient equation."
      ],
      [
        "Nisaba and Nabu",
        "Nisaba is an early scribal goddess; Nabu, son of Marduk and so grandson of Ea, becomes the later scribal god and is tied to the planet Mercury.",
        "Collapsing Nisaba, Nabu, Thoth and Hermes into one original deity."
      ],
      [
        "Ningishzida's staff",
        "Gudea's vase shows two entwined snakes for Ningishzida. That motif is compared with the later caduceus as iconography.",
        "Reading the vase as proof that Hermes's herald staff was a Sumerian cult object."
      ],
      [
        "Adapa, Uanna and Oannes",
        "Adapa is the Eridu sage of the South Wind myth. Oannes is Berossus's Greek name for the first apkallu, Uanna. Identification of Adapa with Uanna/Oannes is scholarly, not a single recovered biography.",
        "Forcing the fisherman story and the fish-man teacher into one narrative without remainder."
      ],
      [
        "Enmeduranki and Enoch",
        "The seventh antediluvian king of Sippar is taught divination in heaven. VanderKam and others argue this as a model for Enoch; Annus (2010) surveys that comparison beside apkallu/Watcher study.",
        "Presenting Enmeduranki as an ancient name of Enoch, or the comparison as a demonstrated identity."
      ]
    ],
    "refs": [
      "enki",
      "nabu-wiki",
      "apkallu",
      "caduceus-wiki",
      "annus"
    ]
  }
};
export const GROUP_PALETTE = [
  "#d4b567",
  "#9d9cf5",
  "#65d9d0",
  "#e5a5c7",
  "#90b5ef",
  "#c8a6ec",
  "#d49a62",
  "#90c887",
  "#b9c0df",
  "#d98989",
  "#d8d29b",
  "#89b4ae",
  "#c8a487",
  "#a7d5a9",
  "#b8a2cd"
] as const;
export const PRIMARY_TRADITION_ORDER = [
  "Egyptian",
  "Greek",
  "Roman / Etruscan",
  "Norse / Celtic",
  "Islamic",
  "Rosicrucian / Masonic",
  "Alchemical",
  "Modern occult",
  "Renaissance",
  "Jewish",
  "Christian",
  "Gnostic crossovers",
  "Hermetic",
  "Mesopotamian",
  "Mesopotamian roots",
  "Yoruba / Afro-Cuban",
  "Bahá'í",
  "Comparative",
] as const;

export function normalise(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function dateText(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
}

export function entryById(id: string): Entry {
  const found = ENTRIES.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown Hermes Atlas entry: ${id}`);
  return found;
}

export function layerOf(entry: Entry): (typeof EVIDENCE_LAYERS)[number] {
  if (MODERN_IDS.has(entry.id)) return "Modern interpretation / fringe";
  if (TRADITION_IDS.has(entry.id)) return "Tradition / identification";
  return "Attested history";
}

export function traditionsOf(entry: Entry): string[] {
  const out = TRADITION_NAMES.filter((key) => TOPIC_IDS[key]?.includes(entry.id));
  if (entry.group === "Egyptian") out.push("Egyptian");
  if (entry.group === "Greek") out.push("Greek");
  if (entry.group === "Roman & Etruscan") out.push("Roman / Etruscan");
  if (entry.group === "Islamic") out.push("Islamic");
  if (entry.group === "Hermetic & Hellenistic") out.push("Hermetic");
  if (entry.group === "Germanic & Celtic") out.push("Norse / Celtic");
  if (entry.group === "Mesopotamian") out.push("Mesopotamian");
  if (entry.group === "Bahá'í") out.push("Bahá'í");
  if (entry.group.includes("Yoruba") || entry.group.includes("Afro")) out.push("Yoruba / Afro-Cuban");
  if (entry.group === "Renaissance & Modern" && entry.year !== null && entry.year >= 1300 && entry.year < 1800) {
    out.push("Renaissance");
  }
  if (MODERN_IDS.has(entry.id)) out.push("Modern occult");
  return out.length ? Array.from(new Set(out)) : ["Comparative"];
}

export function primaryTradition(entry: Entry): string {
  const traditions = traditionsOf(entry);
  return PRIMARY_TRADITION_ORDER.find((key) => traditions.includes(key)) ?? "Comparative";
}

export function edgesFor(id: string): Edge[] {
  return EDGES.filter((edge) => edge.a === id || edge.b === id);
}

export function otherEnd(edge: Edge, id: string): string {
  return edge.a === id ? edge.b : edge.a;
}

export function groupColor(group: string): string {
  const index = GROUPS.indexOf(group as (typeof GROUPS)[number]);
  return GROUP_PALETTE[(index < 0 ? 0 : index) % GROUP_PALETTE.length]!;
}

export function sourceOf(key: string) {
  const source = REFS[key];
  if (!source) throw new Error(`Unknown Hermes Atlas source: ${key}`);
  return source;
}
