export default interface Song {
    id: number;
    title: string;
    majestyNumber?: number;
    stanzas: Stanza[];
    author?: Author;
    majestyScripture?: Scripture;
    tune?: string;
    arrangedBy?: PersonWithYears;
    adaptedBy?: PersonWithYears;
    translatedBy?: PersonWithYears;
    versifiedBy?: PersonWithYears;
    alteredBy?: PersonWithYears;
    otherAuthors?: Author[];
    copyright?: string;
    ccliSongNumber?: number;
    ccliWordsCopyrights?: string;
}

export interface Stanza {
    majestyVerse: number;
    lines: string[];
}

export interface Person {
    name: string;
    andOthers?: boolean;
    stanzas?: number[]
}

export interface PersonWithYears extends Person {
    birthYear?: number | null;
    deathYear?: number | null;
    circaYears?: boolean;
}

export interface PersonWithCentury extends Person {
    century: number;
}

export type Author = PersonWithYears
    | PersonWithCentury
    | { traditional: true }
    | { basedOn: string, year: number }
    | { byWork: string, year: number }
    | { scriptureRef: string }
    | { scripture: string }
    | { source: string }
    | string;

export interface Scripture {
    reference: string;
    text: string;
}