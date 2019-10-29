/// <reference lib="webworker" />
import pako from 'pako';
import { DictionaryData, MatchMessage, MatchingState, MatchMessageEvent } from '@models/common';

addEventListener('message', async (event: MatchMessageEvent) => {

  // Timing variables
  let decompressionTimeStart: number, decompressionTimeEnd: number;
  let parsingOutputTimeStart: number, parsingOutputTimeEnd: number;
  let matchingTimeStart: number, matchingTimeEnd: number;
  let totalTimeStart: number, totalTimeEnd: number;

  totalTimeStart = performance.now();

  postMessage(new MatchMessage(MatchingState.Decompressing, 'Decompressing the dictionary...'));

  // Decompress the dictionary
  decompressionTimeStart = performance.now();

  const dictionary: DictionaryData = JSON.parse(pako.inflate(event.data.dictionary, { to: 'string' }));

  decompressionTimeEnd = performance.now();

  console.log('Dictionary:', dictionary);

  // Match
  matchingTimeStart = performance.now();

  postMessage(new MatchMessage(MatchingState.Matching, 'Matching your literals...'));

  const result: any[] = [];

  // Quick match
  if ( event.data.quickMatch ) {

    for ( const literal of <string[]>event.data.input ) {

      if ( dictionary[literal] ) result.push({ literal: literal, matches: dictionary[literal] });

    }

  }
  // CSV file input
  else {

    for ( const row of event.data.input ) {
console.log('Looking at row', row)
      const literal: string = row[event.data.targetHeader].toLowerCase().trim();
console.log('literal', literal)
      if ( dictionary[literal] ) result.push({ literal: literal, matches: dictionary[literal] });
console.log(dictionary[literal])
    }

  }

  matchingTimeEnd = performance.now();

  // Parse the result as string CSV (output)
  parsingOutputTimeStart = performance.now();

  console.log(result);

  parsingOutputTimeEnd = performance.now();

  totalTimeEnd = performance.now();

  postMessage(new MatchMessage(MatchingState.Finished, 'Done!', {
    csv: <any>result,
    count: result.length,
    downloadTime: event.data.downloadTime,
    decompressionTime: Math.round(decompressionTimeEnd - decompressionTimeStart),
    parsingInputTime: event.data.parsingTime,
    parsingOutputTime: Math.round(parsingOutputTimeEnd - parsingOutputTimeStart),
    matchingTime: Math.round(matchingTimeEnd - matchingTimeStart),
    totalTime: Math.round(totalTimeEnd - totalTimeStart) + event.data.downloadTime + event.data.parsingTime
  }));

});
