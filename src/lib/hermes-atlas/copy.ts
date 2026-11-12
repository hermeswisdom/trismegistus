import type { DeeperRoute, WisdomTheme } from "./types.ts";

export const TOC = [
  {
    "label": "Explore the constellation",
    "id": "explore"
  },
  {
    "label": "Guided threads",
    "id": "tours",
    "depth": 1
  },
  {
    "label": "Selected figure & its links",
    "id": "detail"
  },
  {
    "label": "Master timeline",
    "id": "timeline"
  },
  {
    "label": "Stories & wisdom themes",
    "id": "stories"
  },
  {
    "label": "Deeper Hermetic routes",
    "id": "deeper"
  },
  {
    "label": "Symbols glossary",
    "id": "symbols"
  },
  {
    "label": "Browse every name",
    "id": "index"
  },
  {
    "label": "How to read the evidence",
    "id": "method"
  },
  {
    "label": "Sources & further reading",
    "id": "sources"
  }
] as const;

export const EXTRA_ALIASES: readonly [string, string][] = [
  [
    "Krater",
    "krater"
  ],
  [
    "mixing bowl",
    "krater"
  ],
  [
    "The Key",
    "key"
  ],
  [
    "Chymical Wedding",
    "chymical-wedding"
  ],
  [
    "Golden Dawn",
    "golden-dawn"
  ],
  [
    "Nag Hammadi",
    "nag-hammadi"
  ],
  [
    "Codex VI",
    "nag-hammadi"
  ],
  [
    "Kore Kosmou",
    "stobaeus"
  ],
  [
    "Ficino",
    "ficino"
  ],
  [
    "Cosimo",
    "cosimo"
  ],
  [
    "Pico",
    "pico"
  ],
  [
    "Bruno",
    "bruno"
  ],
  [
    "Lazzarelli",
    "lazzarelli"
  ],
  [
    "Agrippa",
    "agrippa"
  ],
  [
    "Trithemius",
    "trithemius"
  ],
  [
    "Casaubon",
    "casaubon"
  ],
  [
    "Maier",
    "maier"
  ],
  [
    "Westcott",
    "westcott"
  ],
  [
    "Mathers",
    "mathers"
  ],
  [
    "Farr",
    "farr"
  ],
  [
    "Crowley",
    "crowley-thelema"
  ],
  [
    "Blavatsky",
    "blavatsky"
  ],
  [
    "Kingsford",
    "kingsford"
  ],
  [
    "Mead",
    "mead"
  ],
  [
    "al-Buni",
    "buni"
  ],
  [
    "Santos Bonacci",
    "bonacci"
  ],
  [
    "Ea",
    "enki"
  ],
  [
    "Ningišzida",
    "ningishzida"
  ],
  [
    "Uanna",
    "oannes"
  ],
  [
    "Seven Sages",
    "apkallu"
  ],
  [
    "Enmenduranki",
    "enmeduranki"
  ],
  [
    "En-men-dur-ana",
    "enmeduranki"
  ]
];

export const STORY_IDS = [
  "hermes",
  "thoth",
  "idris",
  "enoch",
  "hermanubis",
  "plato",
  "abumashar",
  "emerald",
  "ficino",
  "casaubon",
  "eshu",
  "kybalion"
] as const;

export const WISDOM_THEMES: WisdomTheme[] = [
  {
    "title": "Messages & interpretation",
    "body": "Hermes, Iris and Gabriel move messages between worlds, but their theological roles differ. The act of mediation is the comparison; shared identity is not the conclusion.",
    "ids": [
      "hermes",
      "iris",
      "gabriel"
    ]
  },
  {
    "title": "Writing & true understanding",
    "body": "Thoth, Seshat and Nabû connect knowledge with writing and measurement. Plato's Theuth story asks whether written information is the same as lived wisdom.",
    "ids": [
      "thoth",
      "seshat",
      "nisaba",
      "nabu",
      "plato"
    ]
  },
  {
    "title": "Death & the crossing of boundaries",
    "body": "Hermes guides souls, Anubis attends funerary passage, Thoth records and Ma'at supplies the standard of truth. The ancient composite Hermanubis is stronger evidence than a modern resemblance.",
    "ids": [
      "psychopomp",
      "anubis",
      "maat",
      "hermanubis"
    ]
  },
  {
    "title": "Heavenly ascent & revealed sciences",
    "body": "Enochic journeys and later Idris–Hermes accounts make wisdom a gift of higher realms. Different texts produce different heavenly teachers; none proves the whole chain had one historical founder.",
    "ids": [
      "enoch",
      "idris",
      "metatron",
      "suhrawardi"
    ]
  },
  {
    "title": "Cosmos, mind & transformation",
    "body": "The philosophical Hermetica explore divine Mind and spiritual rebirth. Alchemy, Paracelsian medicine, Jung and New Thought transform this inheritance in different directions.",
    "ids": [
      "poimandres",
      "corpus",
      "alchemy",
      "jung",
      "kybalion"
    ]
  },
  {
    "title": "A single ancient wisdom?",
    "body": "Prisca theologia was a powerful Renaissance theory of one primordial revelation. This map presents that theory as a historical belief, not as a finding that all religions are secretly the same.",
    "ids": [
      "ficino",
      "pico",
      "pythagoras",
      "fuxi"
    ]
  }
];

export const DEEPER_ROUTES: DeeperRoute[] = [
  {
    "title": "Egyptian books, not one mythical library",
    "body": "Compare the Setne story's dangerous book with the surviving Demotic dialogue, Clement's forty-two books and Hermopolis's creation traditions.",
    "ids": [
      "book-thoth",
      "forty-two",
      "ogdoad",
      "thrice-great",
      "ptah-logos"
    ]
  },
  {
    "title": "Ancient Hermetica outside the Corpus",
    "body": "Coptic prayer and ascent, Armenian aphorisms and Stobaeus's Isis–Horus narrative reveal strands often missed by modern seven-principle summaries.",
    "ids": [
      "nag-hammadi",
      "stobaeus",
      "definitions",
      "iamblichus",
      "magical-papyri"
    ]
  },
  {
    "title": "Arabic hidden sciences",
    "body": "Read the documented traffic between encyclopaedic philosophy, astral magic, guiding spiritual natures and Harranian material, while keeping texts and communities distinct.",
    "ids": [
      "picatrix",
      "ikhwan",
      "perfect-nature",
      "harran",
      "balinas",
      "jabir",
      "suhrawardi"
    ]
  },
  {
    "title": "Alchemy, stars and early science",
    "body": "Zosimos, decanal medicine and Newton's Tablet manuscript show different historical forms of transformation and correspondence. Historical influence does not validate magical efficacy.",
    "ids": [
      "zosimos",
      "decans",
      "alchemy",
      "newton",
      "paracelsus"
    ]
  },
  {
    "title": "Public artworks & Christian re-readings",
    "body": "Hermes stands on Siena Cathedral's floor; patrons, translators and diagram-makers carry his authority into Christian Europe. These are visible historical routes, not only secret-lineage stories.",
    "ids": [
      "siena",
      "cosimo",
      "ficino",
      "dee",
      "fludd",
      "pymander",
      "cabala"
    ]
  },
  {
    "title": "Modern occult systems—and false antiquity",
    "body": "Golden Dawn correspondences and Crowley's tarot are modern syntheses. Court de Gebelin's Egyptian tarot origin theory is unsupported; Doreal's Atlantean tablets are modern pseudohistory, not the medieval Emerald Tablet.",
    "ids": [
      "golden-dawn",
      "tarot-egypt",
      "thoth-tarot",
      "kybalion",
      "doreal",
      "bonacci"
    ]
  },
  {
    "title": "Contemporary astrotheology · Santos Bonacci",
    "body": "Explore Bonacci's Universal Truth School framework: common natural cycles, Hermes–Thoth–Enoch, the Emerald Tablet and the Bible as celestial and bodily allegory. These are attributed modern interpretations, kept separate from the evidence for ancient religious history.",
    "ids": [
      "bonacci",
      "emerald",
      "enoch",
      "trismegistus",
      "planet"
    ]
  },
  {
    "title": "Every Corpus tractate, not a seven-principle summary",
    "body": "Read all seventeen surviving numbered treatises: revelation, the mixing bowl of Mind, the Key, rebirth and royal praise. The collection has no CH XV in modern numbering.",
    "ids": [
      "corpus",
      "poimandres",
      "ch2",
      "ch3",
      "krater",
      "ch5",
      "ch6",
      "ch7",
      "ch8",
      "ch9",
      "key",
      "ch11",
      "ch12",
      "rebirth",
      "ch14",
      "ch16",
      "ch17",
      "ch18"
    ]
  },
  {
    "title": "Teaching circle, Coptic ritual and Byzantine readers",
    "body": "Separate literary teachers and pupils, Coptic prayers and Greek manuscript preservation. These are concrete witnesses, not evidence of an unchanged secret lodge.",
    "ids": [
      "tat",
      "asclepius-pupil",
      "ammon",
      "eighth-ninth",
      "thanksgiving",
      "gnostic-crossovers",
      "psellus",
      "twenty-four"
    ]
  },
  {
    "title": "Renaissance Hermeticism beyond Ficino",
    "body": "Compare Lazzarelli's rebirth theology, Agrippa's occult philosophy, Patrizi's curriculum reform and the Yates debate. Historical correspondence is firmer than a claimed universal initiation succession.",
    "ids": [
      "prisca",
      "lazzarelli",
      "correggio",
      "trithemius",
      "agrippa",
      "patrizi",
      "kircher",
      "yates"
    ]
  },
  {
    "title": "Mercurius, emblems and the Rosicrucian publications",
    "body": "Material principles, sealed vessels and symbolic unions meet Christian reforming literature. The Chymical Wedding has a full seven-day reading guide; Jung's interpretation remains modern.",
    "ids": [
      "tria-prima",
      "hermetic-vessel",
      "rosarium",
      "fama",
      "confessio",
      "chymical-wedding",
      "maier",
      "atalanta",
      "cooke",
      "hermetic-degrees"
    ]
  },
  {
    "title": "People who shaped the modern revival",
    "body": "Explore publishers, performers, translators and organisers rather than treating every modern occult book as the same teaching. Claims of ancient provenance remain separately assessed.",
    "ids": [
      "kingsford",
      "luxor",
      "blavatsky",
      "mead",
      "mathers",
      "westcott",
      "farr",
      "fortune",
      "crowley-thelema",
      "regardie",
      "hall",
      "schwaller",
      "atkinson",
      "new-age"
    ]
  },
  {
    "title": "Technical arts and carefully limited comparisons",
    "body": "Healing magic and astrological medicine have specific textual witnesses. The Circle of Letters allows a concrete Arabic comparison; Daoist neidan is shown only as a distinct comparative tradition, not a Hermes alias.",
    "ids": [
      "kyranides",
      "iatromathematika",
      "sirr-khaliqa",
      "arabic-hermetica",
      "letter-circle",
      "buni",
      "neidan",
      "spell125",
      "uley",
      "caesar",
      "tacitus"
    ]
  },
  {
    "title": "Unexpected but specific contacts",
    "body": "Mercury's patronage of the Mithraic Raven grade is a real ancient association. Hermes Logios concerns eloquence, not automatic identity with every religious doctrine of the Word.",
    "ids": [
      "corax",
      "logios",
      "ptah-logos",
      "metatron"
    ]
  }
];

export const SYMBOL_ROWS: readonly (readonly string[])[] = [
  [
    "Caduceus / kērykeion",
    "Hermes/Mercury's heraldic staff, usually two snakes",
    "Wings are optional in ancient art; not the original one-snake medical rod."
  ],
  [
    "Rod of Asclepius",
    "Single snake on a staff; healing",
    "Different divine owner and symbolism from Hermes's caduceus."
  ],
  [
    "Talaria / winged sandals",
    "Swift travel and movement between worlds",
    "Not every ancient sandal depiction is winged."
  ],
  [
    "Petasos",
    "Traveller's broad-brimmed hat",
    "Wings become familiar in later representations; the hat can be plain."
  ],
  [
    "Tortoise & lyre",
    "Hermes invents the lyre in the cattle-theft hymn",
    "Apollo becomes the famous lyre player through exchange, not identity."
  ],
  [
    "Herm / boundary pillar",
    "Threshold protection and demarcation",
    "Often includes a phallus; not merely a modern decorative bust."
  ],
  [
    "Ibis & baboon",
    "Animal forms sacred to Thoth",
    "Two Egyptian forms of the same deity, not Hermes's usual Greek animals."
  ],
  [
    "Lunar disk & crescent",
    "Thoth's reckoning of time and lunar associations",
    "Thoth is a lunar deity even though Hermes also acquires a Mercury connection."
  ],
  [
    "Scribal palette, reed, tablet",
    "Thoth, Seshat and Nabû in different cultural systems",
    "Shared writing symbols do not establish one universal god."
  ],
  [
    "Feather & balance",
    "Ma'at and judgement of the heart",
    "Anubis attends the weighing; Thoth records it."
  ],
  [
    "Ankh",
    "Egyptian sign of life, carried by many deities",
    "Not exclusive to Thoth or a secret spelling of Hermes."
  ],
  [
    "Jackal head",
    "Anubis; combined with the caduceus in Hermanubis",
    "A specific composite iconography, not every jackal-headed figure."
  ],
  [
    "☿ / quicksilver",
    "Mercury's planetary sign and the metal in alchemy",
    "Alchemical mercurius may also mean a principle; liquid mercury is toxic."
  ],
  [
    "Rose and cross",
    "Rosicrucian traditions",
    "Early modern/later reception does not prove institutional continuity from Egypt."
  ],
  [
    "Square and compasses",
    "Freemasonry's building symbolism",
    "Not an ancient Hermes emblem; Hermetic readings vary by rite and author."
  ],
  [
    "Crossroads / open door",
    "Hermes; also Èṣù and Eleguá in distinct religious worlds",
    "A comparative motif, not permission to erase living traditions' differences."
  ]
];

export const METHOD_ROWS: readonly (readonly string[])[] = [
  [
    "Greco-Roman equivalent",
    "Ancient identification of Hermes and Mercury",
    "That their earliest cults and every myth were identical."
  ],
  [
    "Syncretism",
    "A real historical combination, such as Hermanubis or Hermes–Thoth",
    "That the gods had always been one in every worshipper's view."
  ],
  [
    "Ancient comparison",
    "An ancient cross-cultural interpretive framework",
    "A simple translation of a native name; some native identities are reconstructed."
  ],
  [
    "Traditional identification",
    "A particular author, text or community equated figures",
    "An independently verified shared historical biography."
  ],
  [
    "Text & transmission",
    "Attribution, translation, quotation or intellectual inheritance",
    "That the named ancient sage personally wrote the surviving work."
  ],
  [
    "Myth & ritual",
    "Family, story, worship or iconographic relationships",
    "Historically verifiable supernatural events."
  ],
  [
    "Planet & calendar",
    "A shared celestial referent or weekday correspondence",
    "Identical theology, or scientifically established astrological effects."
  ],
  [
    "Parallel only",
    "A meaningful comparison of narrative roles or imagery",
    "Contact, borrowing, descent or identity without further evidence."
  ],
  [
    "Modern reception",
    "Later reinterpretation and claims of ancient wisdom",
    "Authentic ancient provenance for every modern teaching."
  ]
];

export const TIMELINE_ROWS: readonly (readonly string[])[] = [
  [
    "Thoth's early Egyptian setting",
    "c. 3000 BCE horizon; secure Old Kingdom evidence",
    "Not a precise birthday or a claim that all Hermetic texts existed then."
  ],
  [
    "Hermes in Mycenaean records",
    "2nd millennium BCE",
    "The Greek god predates Hellenistic Hermes–Thoth synthesis."
  ],
  [
    "Philosophical Hermetica",
    "Mainly 1st–3rd centuries CE",
    "Ancient, but not surviving books authored by a pre-Mosaic sage."
  ],
  [
    "Idris in Qur'an and Mi'raj tradition",
    "7th-century scriptural context; later hadith compilations",
    "The timeline locates textual witnesses, not a claim that Idris lived in 620 CE."
  ],
  [
    "Arabic Hermes biographies",
    "9th century CE onward",
    "Idris/Enoch and the three Hermeses organise a history of the sciences."
  ],
  [
    "Ficino's Latin translation",
    "1463; printed 1471",
    "The influential Renaissance revival of fourteen treatises."
  ],
  [
    "Casaubon's critical dating",
    "1614",
    "Challenges the claim that the Corpus predates Moses."
  ],
  [
    "The Kybalion",
    "1908",
    "Modern New Thought-influenced esotericism, not an ancient Egyptian text."
  ],
  [
    "Santos Bonacci's contemporary astrotheology",
    "21st-century lecturing; dated website essay, 2017",
    "Modern interpretation of Hermetic, astronomical and bodily correspondences; not an ancient witness or a verified first-lecture date."
  ]
];

export const SOURCE_KEYS = [
  "faivre",
  "hanegraaff",
  "chtexts",
  "iatro",
  "letters",
  "neidan",
  "luxor",
  "kingsford",
  "arab",
  "prophet",
  "three",
  "bmcr",
  "cam",
  "od",
  "q",
  "q2",
  "gen",
  "hymn",
  "nabu",
  "plato",
  "lact",
  "aug",
  "suh"
] as const;

export const DEEPER_SOURCE_KEYS = [
  "litwa",
  "nag",
  "kore",
  "ikhwan",
  "saif",
  "siena",
  "newton",
  "hermetica",
  "thothbook",
  "doreal"
] as const;

export const IDRIS_QUOTES = [
  {
    cite: "Qur'an 19:56–57, Yusuf Ali translation",
    text: "Also mention in the Book the case of Idris: He was a man of truth (and sincerity), (and) a prophet: And We raised him to an exalted place.",
  },
  {
    cite: "Qur'an 21:85–86, Yusuf Ali translation",
    text: "And (remember) Isma'il, Idris, and Dhu al-Kifl, all (men) of constancy and patience; We admitted them to Our mercy: for they were of the righteous ones.",
  },
] as const;

export const IDRIS_ROWS: readonly (readonly string[])[] = [
  [
    "Qur'anic wording",
    "Truthfulness, prophethood, a high station, patience and divine mercy.",
    "The Arabic text names Idris. Some translations render the name as Enoch, incorporating the traditional identification."
  ],
  [
    "Mi'raj hadith",
    "Sahih Muslim 162a: Muhammad, with Gabriel, meets Idris in the fourth heaven; Idris welcomes him and prays for him.",
    "A report in a major authenticated Sunni hadith collection, distinct from the Qur'an itself."
  ],
  [
    "Pen, garments & stars",
    "Historical and exegetical reports credit Idris with writing with the pen, sewing garments, observing the stars and reckoning.",
    "Reports and attributions vary. Ibn Ishaq's first-pen report is transmitted by later writers; not every popular invention story is an authenticated Prophetic hadith."
  ],
  [
    "Idris = Enoch / Akhnukh",
    "Many Muslim commentators identify Idris with the pre-Flood patriarch Enoch.",
    "Widespread traditional identification, not an explicit Qur'anic equation or a proven historical biography."
  ],
  [
    "Idris = Hermes",
    "Abu Ma'shar's first, pre-Flood Egyptian Hermes is identified with Enoch/Idris; two further Hermeses organise later learning.",
    "A medieval learned chronology, known through quotations from his lost Book of Thousands. Later writers develop the identification differently."
  ],
  [
    "Hermes al-Haramisa",
    "Hirmis al-Harāmisa means Hermes of the Hermeses; later accounts connect the Great Hermes with Idris and Enoch.",
    "A later learned title and reception, not a name occurring in the Qur'an. The Ashkevari notice illustrates this tradition; its online rendering is mediated through a French translation."
  ]
];

export const BONACCI_QUOTE = {
  cite: "Universal Truth School, Raising the Chrism, 3 February 2017",
  text: "The Bible is a manual about physiological regeneration and astrology, written in code",
} as const;

export const BONACCI_ROWS: readonly (readonly string[])[] = [
  [
    "One underlying wisdom",
    "His About page says ancient myths, Bibles and fairy tales share a common origin in cycles of nature, with recurring characters under different names.",
    "This is his modern universalising framework. Scholarship traces particular texts, cults and transfers; it does not establish every religion as one astronomical code."
  ],
  [
    "Hermes, Thoth and Enoch",
    "The Alchemy and Ascension Within clip introduces the short Tablet using all three names; his About page includes Hermes among transmitters of hidden wisdom.",
    "The ancient Hermes–Thoth synthesis is documented, but Enoch/Hermes identifications have their own later reception history. The sources checked do not establish his exact wording 'Hermes is the hidden architect of all religions'."
  ],
  [
    "Emerald Tablet",
    "He recites the short Tablet, including the above/below and sun/moon passages, then assigns them celestial and bodily meanings.",
    "The short Emerald Tablet is first attested in medieval Arabic witnesses. A clip may call it 'tablets', but that does not establish that he is discussing Doreal's separate fifteen-tablet work."
  ],
  [
    "Astrotheology and the body",
    "His website explicitly presents the Bible as coded astrology and bodily regeneration; the clip interprets biblical images through planets, zodiac signs and bodily structures.",
    "These are esoteric readings, not a demonstrated decoding of every biblical text. The proposed gland/spinal-oil correspondences are not established anatomy or medical treatments."
  ],
  [
    "Prisca theologia",
    "The Ancient Theology lecture discusses ancient theology, Pico and Ficino as part of a proposed unity of learning.",
    "The Renaissance belief in primordial wisdom is itself a historical object of study. It does not verify an unbroken, single teaching from prehistoric Egypt to modern lectures."
  ],
  [
    "Idris and Nag Hammadi",
    "No specific attributable discussion of Idris or Nag Hammadi Codex VI was verified in the Bonacci sources consulted for this addition.",
    "Their separate entries remain in the atlas, but no direct Bonacci edge is asserted without a supporting passage. Another writer's Nag Hammadi/Thoth theory must not be reassigned to him."
  ]
];

export const METHOD_SCOPE =
  "Scope: Greece, Rome, Etruria, Egypt, Mesopotamia, selected Germanic and Celtic traditions, Judaism, Christianity, Islam, Hindu planetary religion, the Bahá'í Faith, Yoruba and Afro-Cuban traditions, selected Indigenous North American stories and a later European reading of Fuxi. Buddhism, Jainism, Sikh traditions and many others are not given invented Hermes equivalents. Budha is not the Buddha. “Jewish & Christian” and other combined colours are browsing categories, not claims that those religions are interchangeable.";

export const METHOD_BOUNDARIES =
  "Comparative boundaries: the al-Buni link compares Arabic sciences of letters with an actual Hermes-attributed letter treatise; no direct Hermes-to-al-Buni initiation is established. Daoist neidan is a comparison of imagery and transformation, not a proven Hermetic transmission. No Buddhist Hermes equivalent is invented, and Budha remains distinct from the Buddha. Specific claims of channelled ancient texts require independent provenance; the map does not authenticate them.";

export const METHOD_EDITORIAL =
  "Editorial approach: ancient myths are labelled as myths; scripture is separated from later interpretation; pseudonymous writings are not assigned to their claimed authors as fact; oral traditions are not assigned fabricated origin dates. General encyclopaedia entries provide orientation and bibliography; scholarly studies and primary-text passages support the core historical distinctions. The drawings are original symbolic diagrams so the Page has no dependency on remote image permissions or changing image URLs.";

export const FURTHER_READING =
  "Further specialist anchors: Christian H. Bull, The Tradition of Hermes Trismegistus (Brill, 2018); Brian P. Copenhaver, Hermetica (Cambridge, 1992); Garth Fowden, The Egyptian Hermes (1986/1993); Kevin van Bladel, The Arabic Hermes (Oxford, 2009); Florian Ebeling, The Secret History of Hermes Trismegistus (English translation, 2007). Earlier sweeping accounts are best read alongside more recent work, especially on Egyptian priestly contexts and Arabic transmission.";

export const CALLOUT_LEAD = "Connected does not mean identical";
export const CALLOUT_BODY =
  "Mercury is Hermes's Greco-Roman equivalent; Thoth is part of an ancient syncretism; Idris is a later traditional identification; Loki and Coyote are comparative parallels. Every link explains which kind of connection is meant. This is a broad, curated atlas—not a claim to cover every religion or to reduce them to one hidden system.";
