export type ScriptureTheme =
  | "home"
  | "mercy"
  | "character"
  | "trial"
  | "work"
  | "holiness"
  | "faith"
  | "brotherhood"
  | "speech"
  | "wisdom";

export type ScriptureEntry = {
  id: string;
  reference: string;
  kjv: string;
  keywords: string[];
  theme: ScriptureTheme;
};

/** Public-domain KJV. Verse wording stays here — generators must not invent it. */
export const SCRIPTURE_CATALOG: ScriptureEntry[] = [
  {
    id: "eph-5-25",
    reference: "Ephesians 5:25",
    kjv: "Husbands, love your wives, even as Christ also loved the church, and gave himself for it.",
    keywords: [
      "head of the household",
      "head of household",
      "head of the house",
      "husband",
      "husbands",
      "wife",
      "wives",
      "marriage",
      "household",
      "house",
      "home",
      "family",
      "head",
    ],
    theme: "home",
  },
  {
    id: "eph-5-23",
    reference: "Ephesians 5:23",
    kjv: "For the husband is the head of the wife, even as Christ is the head of the church: and he is the saviour of the body.",
    keywords: ["head", "husband", "wife", "church", "household", "leadership", "home"],
    theme: "home",
  },
  {
    id: "josh-24-15",
    reference: "Joshua 24:15",
    kjv: "And if it seem evil unto you to serve the Lord, choose you this day whom ye will serve; whether the gods which your fathers served that were on the other side of the flood, or the gods of the Amorites, in whose land ye dwell: but as for me and my house, we will serve the Lord.",
    keywords: ["house", "home", "household", "family", "serve", "choose", "joshua"],
    theme: "home",
  },
  {
    id: "1tim-3-4",
    reference: "1 Timothy 3:4",
    kjv: "One that ruleth well his own house, having his children in subjection with all gravity;",
    keywords: ["rule", "house", "household", "children", "father", "home", "family"],
    theme: "home",
  },
  {
    id: "eph-6-4",
    reference: "Ephesians 6:4",
    kjv: "And, ye fathers, provoke not your children to wrath: but bring them up in the nurture and admonition of the Lord.",
    keywords: ["father", "fathers", "children", "kids", "parent", "parenting", "nurture"],
    theme: "home",
  },
  {
    id: "col-3-19",
    reference: "Colossians 3:19",
    kjv: "Husbands, love your wives, and be not bitter against them.",
    keywords: ["husband", "wife", "marriage", "bitter", "bitterness"],
    theme: "home",
  },
  {
    id: "gen-2-24",
    reference: "Genesis 2:24",
    kjv: "Therefore shall a man leave his father and his mother, and shall cleave unto his wife: and they shall be one flesh.",
    keywords: ["marriage", "wife", "cleave", "one flesh", "wedding"],
    theme: "home",
  },
  {
    id: "matt-6-14",
    reference: "Matthew 6:14",
    kjv: "For if ye forgive men their trespasses, your heavenly Father will also forgive you.",
    keywords: ["forgive", "forgiveness", "mercy", "trespass", "grace"],
    theme: "mercy",
  },
  {
    id: "col-3-13",
    reference: "Colossians 3:13",
    kjv: "Forbearing one another, and forgiving one another, if any man have a quarrel against any: even as Christ forgave you, so also do ye.",
    keywords: ["forgive", "forgiving", "quarrel", "mercy", "forbear"],
    theme: "mercy",
  },
  {
    id: "micah-6-8",
    reference: "Micah 6:8",
    kjv: "He hath shewed thee, O man, what is good; and what doth the Lord require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?",
    keywords: ["justice", "mercy", "humble", "humility", "require", "walk"],
    theme: "character",
  },
  {
    id: "prov-10-9",
    reference: "Proverbs 10:9",
    kjv: "He that walketh uprightly walketh surely: but he that perverteth his ways shall be known.",
    keywords: ["integrity", "upright", "honest", "honesty", "character"],
    theme: "character",
  },
  {
    id: "prov-16-32",
    reference: "Proverbs 16:32",
    kjv: "He that is slow to anger is better than the mighty; and he that ruleth his spirit than he that taketh a city.",
    keywords: ["anger", "temper", "self-control", "self control", "spirit", "patience"],
    theme: "character",
  },
  {
    id: "1cor-16-13",
    reference: "1 Corinthians 16:13",
    kjv: "Watch ye, stand fast in the faith, quit you like men, be strong.",
    keywords: ["courage", "strong", "men", "manhood", "stand", "watch"],
    theme: "character",
  },
  {
    id: "josh-1-9",
    reference: "Joshua 1:9",
    kjv: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.",
    keywords: ["courage", "fear", "afraid", "strong", "joshua"],
    theme: "character",
  },
  {
    id: "col-3-23",
    reference: "Colossians 3:23",
    kjv: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men.",
    keywords: ["work", "job", "labor", "labour", "workplace", "diligence"],
    theme: "work",
  },
  {
    id: "prov-14-23",
    reference: "Proverbs 14:23",
    kjv: "In all labour there is profit: but the talk of the lips tendeth only to penury.",
    keywords: ["work", "labour", "labor", "profit", "idle", "talk"],
    theme: "work",
  },
  {
    id: "james-1-2",
    reference: "James 1:2-3",
    kjv: "My brethren, count it all joy when ye fall into divers temptations; knowing this, that the trying of your faith worketh patience.",
    keywords: ["trial", "trials", "testing", "patience", "suffering", "hardship"],
    theme: "trial",
  },
  {
    id: "rom-8-28",
    reference: "Romans 8:28",
    kjv: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
    keywords: ["purpose", "suffering", "all things", "good", "called"],
    theme: "trial",
  },
  {
    id: "phil-4-6",
    reference: "Philippians 4:6-7",
    kjv: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.",
    keywords: ["anxiety", "worry", "peace", "prayer", "careful", "stress"],
    theme: "trial",
  },
  {
    id: "heb-13-5",
    reference: "Hebrews 13:5",
    kjv: "Let your conversation be without covetousness; and be content with such things as ye have: for he hath said, I will never leave thee, nor forsake thee.",
    keywords: ["content", "contentment", "covet", "money", "enough"],
    theme: "faith",
  },
  {
    id: "matt-6-33",
    reference: "Matthew 6:33",
    kjv: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.",
    keywords: ["priority", "first", "kingdom", "seek", "money", "provision"],
    theme: "faith",
  },
  {
    id: "prov-3-5",
    reference: "Proverbs 3:5-6",
    kjv: "Trust in the Lord with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
    keywords: ["trust", "wisdom", "guidance", "direction", "lean", "paths"],
    theme: "wisdom",
  },
  {
    id: "james-1-22",
    reference: "James 1:22",
    kjv: "But be ye doers of the word, and not hearers only, deceiving your own selves.",
    keywords: ["doers", "word", "obedience", "hearers", "bible", "scripture"],
    theme: "wisdom",
  },
  {
    id: "ps-119-105",
    reference: "Psalm 119:105",
    kjv: "Thy word is a lamp unto my feet, and a light unto my path.",
    keywords: ["word", "bible", "scripture", "lamp", "path", "guidance"],
    theme: "wisdom",
  },
  {
    id: "1thess-4-3",
    reference: "1 Thessalonians 4:3-4",
    kjv: "For this is the will of God, even your sanctification, that ye should abstain from fornication: that every one of you should know how to possess his vessel in sanctification and honour;",
    keywords: ["purity", "lust", "sexual", "sanctification", "fornication", "honor", "honour"],
    theme: "holiness",
  },
  {
    id: "2tim-2-22",
    reference: "2 Timothy 2:22",
    kjv: "Flee also youthful lusts: but follow righteousness, faith, charity, peace, with them that call on the Lord out of a pure heart.",
    keywords: ["lust", "flee", "purity", "youth", "temptation"],
    theme: "holiness",
  },
  {
    id: "prov-27-17",
    reference: "Proverbs 27:17",
    kjv: "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.",
    keywords: ["brotherhood", "friend", "iron", "sharpen", "accountability"],
    theme: "brotherhood",
  },
  {
    id: "ecc-4-9",
    reference: "Ecclesiastes 4:9-10",
    kjv: "Two are better than one; because they have a good reward for their labour. For if they fall, the one will lift up his fellow: but woe to him that is alone when he falleth; for he hath not another to help him up.",
    keywords: ["accountability", "alone", "two", "together", "fall"],
    theme: "brotherhood",
  },
  {
    id: "mark-10-45",
    reference: "Mark 10:45",
    kjv: "For even the Son of man came not to be ministered unto, but to minister, and to give his life a ransom for many.",
    keywords: ["serve", "servant", "leadership", "minister", "ransom"],
    theme: "brotherhood",
  },
  {
    id: "eph-4-29",
    reference: "Ephesians 4:29",
    kjv: "Let no corrupt communication proceed out of your mouth, but that which is good to the use of edifying, that it may minister grace unto the hearers.",
    keywords: ["speech", "mouth", "words", "talk", "edify", "language"],
    theme: "speech",
  },
  {
    id: "james-1-19",
    reference: "James 1:19",
    kjv: "Wherefore, my beloved brethren, let every man be swift to hear, slow to speak, slow to wrath:",
    keywords: ["listen", "speech", "wrath", "slow", "hear", "words"],
    theme: "speech",
  },
  {
    id: "phil-2-3",
    reference: "Philippians 2:3",
    kjv: "Let nothing be done through strife or vainglory; but in lowliness of mind let each esteem other better than themselves.",
    keywords: ["pride", "humble", "humility", "vainglory", "others"],
    theme: "character",
  },
  {
    id: "1pet-5-6",
    reference: "1 Peter 5:6-7",
    kjv: "Humble yourselves therefore under the mighty hand of God, that he may exalt you in due time: casting all your care upon him; for he careth for you.",
    keywords: ["humble", "care", "anxiety", "worry", "cast"],
    theme: "faith",
  },
];

export const DEFAULT_SCRIPTURE = SCRIPTURE_CATALOG.find((entry) => entry.id === "james-1-22") ?? SCRIPTURE_CATALOG[0];
