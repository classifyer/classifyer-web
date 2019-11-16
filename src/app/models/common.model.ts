export interface DictionaryData {

  [literal: string]: DictionaryMapping[];

}

export interface DictionaryMapping {

  code: string;
  standard: string;
  contributor: string;
  [metadata: string]: string;

}

export class MatchMessage {

  constructor(
    public state: MatchingState,
    public message: string,
    public result?: MatchResult,
    public error?: Error
  ) { }

}

export interface MatchResult {

  count: number;
  csv: string;
  tabDelimited?: string;
  downloadTime: number;
  decompressionTime: number;
  parsingInputTime: number;
  parsingOutputTime: number;
  matchingTime: number;
  totalTime: number;

}

export enum MatchingState {

  Started = 'started',
  Downloading = 'downloading',
  Decompressing = 'decompressing',
  Matching = 'matching',
  ParsingOutput = 'parsing-output',
  Finished = 'finished',
  Error = 'error'

}

export interface ParseResult {

  time: number;
  result: any[];

}

export interface MatchingInput {

  input: any[];
  targetHeader?: string;
  userAgent: string;
  dictionary: Uint8Array;
  quickMatch: boolean;
  downloadTime: number;
  parsingTime: number;

}

export interface ParsingInput {

  csv: boolean;
  input: string;

}

export interface MatchMessageEvent extends MessageEvent {

  data: MatchingInput;

}

export interface ParseMessageEvent extends MessageEvent {

  data: ParsingInput;

}
