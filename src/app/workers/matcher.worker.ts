/// <reference lib="webworker" />
import pako from 'pako';
import _ from 'lodash';
import { Parser } from 'json2csv';
import { DictionaryData, DictionaryMapping, MatchMessage, MatchingState, MatchMessageEvent } from '@models/common';

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

  // Match
  matchingTimeStart = performance.now();

  postMessage(new MatchMessage(MatchingState.Matching, 'Matching your literals...'));

  const result: DictionaryMapping[][] = [];
  let matchCount: number = 0;

  // Quick match
  if ( event.data.quickMatch ) {

    for ( const literal of <string[]>event.data.input ) {

      if ( dictionary[literal] ) {

        result.push(dictionary[literal]);
        matchCount++;

      }
      else {

        result.push([]);

      }

    }

  }
  // CSV file input
  else {

    for ( const row of event.data.input ) {

      const literal: string = row[event.data.targetHeader].toLowerCase().trim();

      if ( dictionary[literal] ) {

        result.push(dictionary[literal]);
        matchCount++;

      }
      else {

        result.push([]);

      }

    }

  }

  matchingTimeEnd = performance.now();

  // Parse the result as string CSV (output)
  parsingOutputTimeStart = performance.now();

  console.log(JSON.stringify(result, null, 2));
  console.log(JSON.stringify(event.data.input, null, 2));

  const csvData: any[] = [];
  let csvHeaders: string[] = [];
  let inputHeadersSet: boolean = false;
  let matchHeaderSet: boolean = false;

  // CSV file input
  if ( ! event.data.quickMatch ) {

    while ( result.length ) {

      const matches = result.shift();
      const input = event.data.input.shift();

      // Add input headers
      if ( ! inputHeadersSet ) {

        inputHeadersSet = true;
        csvHeaders = _.keys(input);

      }

      // If no matches
      if ( ! matches.length ) {

        csvData.push(input);
        continue;

      }

      for ( const match of matches ) {

        // Add match headers
        if ( ! matchHeaderSet ) {

          matchHeaderSet = true;
          csvHeaders = _.concat(csvHeaders, _.keys(match));

        }

        csvData.push(_.assign(match, input));

      }

    }

  }
  // Quick match
  else {

    while ( result.length ) {

      const matches = result.shift();
      const input = event.data.input.shift();

      // Add input headers
      if ( ! inputHeadersSet ) {

        inputHeadersSet = true;
        csvHeaders = ['literal'];

      }

      // If no matches
      if ( ! matches.length ) {

        csvData.push({ literal: input });
        continue;

      }

      for ( const match of matches ) {

        // Add match headers
        if ( ! matchHeaderSet ) {

          matchHeaderSet = true;
          csvHeaders = _.concat(csvHeaders, _.keys(match));

        }

        csvData.push(_.assign(match, { literal: input }));

      }

    }

  }

  console.log(JSON.stringify(csvData, null, 2));
  console.log(JSON.stringify(csvHeaders));

  // Convert JSON to CSV
  const parser = new Parser({ fields: csvHeaders });
  const finalCsv = parser.parse(csvData);

  parsingOutputTimeEnd = performance.now();

  totalTimeEnd = performance.now();

  postMessage(new MatchMessage(MatchingState.Finished, 'Done!', {
    csv: finalCsv,
    count: matchCount,
    downloadTime: event.data.downloadTime,
    decompressionTime: Math.round(decompressionTimeEnd - decompressionTimeStart),
    parsingInputTime: event.data.parsingTime,
    parsingOutputTime: Math.round(parsingOutputTimeEnd - parsingOutputTimeStart),
    matchingTime: Math.round(matchingTimeEnd - matchingTimeStart),
    totalTime: Math.round(totalTimeEnd - totalTimeStart) + event.data.downloadTime + event.data.parsingTime
  }));

});
