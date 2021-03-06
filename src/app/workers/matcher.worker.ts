/// <reference lib="webworker" />
import pako from 'pako';
import _ from 'lodash';
import { Parser } from 'json2csv';
import { DictionaryData, DictionaryMapping, MatchMessage, MatchingState, MatchMessageEvent } from '@models/common';

addEventListener('message', (event: MatchMessageEvent) => {

  main(event)
  .catch(postMessage);

});

async function main(event: MatchMessageEvent) {

  // Preserve input length for statistics
  let inputLength = event.data.input.length;

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
  // Total literals matched to one or more classifications
  let matchCount: number = 0;

  // Quick match
  if ( event.data.quickMatch ) {

    for ( let i = 0; i < (<string[]>event.data.input).length; i++ ) {

      let literal = (<string[]>event.data.input)[i];

      if ( dictionary.data[literal] ) {

        result.push(dictionary.data[literal]);
        matchCount++;

      }
      else {

        result.push([]);

      }

    }

  }
  // CSV file input
  else {

    for ( let i = 0; i < event.data.input.length; i++ ) {

      let row = event.data.input[i];

      const literal: string = row[event.data.targetHeader].toLowerCase().trim();

      if ( dictionary.data[literal] ) {

        result.push(dictionary.data[literal]);
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

  postMessage(new MatchMessage(MatchingState.ParsingOutput, 'Preparing the results...'));

  const csvData: any[] = [];
  let csvHeaders: string[] = [];
  let inputHeadersSet: boolean = false;
  let matchHeaderSet: boolean = false;
  // Total number of matches found
  let totalMatchCount: number = 0;

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

      for ( let i = 0; i < matches.length; i++ ) {

        let match = matches[i];

        // Add match headers
        if ( ! matchHeaderSet ) {

          matchHeaderSet = true;
          csvHeaders = _.concat(csvHeaders, _.keys(match));

        }

        totalMatchCount++;
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

      for ( let i = 0; i < matches.length; i++ ) {

        let match = matches[i];

        // Add match headers
        if ( ! matchHeaderSet ) {

          matchHeaderSet = true;
          csvHeaders = _.concat(csvHeaders, _.keys(match));

        }

        totalMatchCount++;
        csvData.push(_.assign(match, { literal: input }));

      }

    }

  }

  // Insert contributors
  for ( let i = 0; i < csvData.length; i++ ) {

    csvData[i].contributor = dictionary.meta.contributors[+csvData[i].contributor];

  }

  // Convert JSON to CSV
  const parser = new Parser({
    fields: csvHeaders,
    defaultValue: 'null'
  });

  let finalCsv = parser.parse(csvData);

  // Revert original headers (remove "1") if CSV match
  if ( ! event.data.quickMatch ) {

    let originalDone: boolean = false;
    let originalHeaders = csvHeaders.map(header => {

      if ( originalDone || header === 'code' ) {

        originalDone = true;
        return `"${header}"`;

      }

      return `"${header.substr(0, header.length - 1)}"`;

    });

    finalCsv = finalCsv.replace(finalCsv.substr(0, finalCsv.indexOf('\n') + 1), originalHeaders.join(',') + '\n');

  }

  // Convert JSON to Excel (for quick match copy to clipboard feature)
  let tabDelimited: string = undefined;

  if ( event.data.quickMatch ) {

    const tabParser = new Parser({
      fields: csvHeaders,
      header: false,
      delimiter: '\t',
      defaultValue: 'null'
    });

    tabDelimited = tabParser.parse(csvData);

  }

  parsingOutputTimeEnd = performance.now();

  totalTimeEnd = performance.now();

  postMessage(new MatchMessage(MatchingState.Finished, 'Done!', {
    csv: finalCsv,
    tabDelimited: tabDelimited,
    count: matchCount,
    totalCount: totalMatchCount,
    inputCount: inputLength,
    downloadTime: event.data.downloadTime,
    decompressionTime: Math.round(decompressionTimeEnd - decompressionTimeStart),
    parsingInputTime: event.data.parsingTime,
    parsingOutputTime: Math.round(parsingOutputTimeEnd - parsingOutputTimeStart),
    matchingTime: Math.round(matchingTimeEnd - matchingTimeStart),
    totalTime: Math.round(totalTimeEnd - totalTimeStart) + event.data.downloadTime + event.data.parsingTime
  }));

}
