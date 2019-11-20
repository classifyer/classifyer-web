/// <reference lib="webworker" />
import { ParseMessageEvent } from '@models/common';
import csv from 'csvtojson';
import _ from 'lodash';

addEventListener('message', (event: ParseMessageEvent) => {

  main(event)
  .catch(postMessage);

});

async function main(event: ParseMessageEvent) {

  // Parse CSV file
  if ( event.data.csv ) {

    const parsingInputTimeStart = performance.now();
    // Extract headers from input
    const originalHeaders = _.values((await csv({ noheader: true }).fromString(event.data.input.substr(0, event.data.input.indexOf('\n')).replace(/\r/g, '')))[0]);
    // Make headers unique by appending "1" to them to avoid overwriting matched data with the same headers
    // This will be reverted in the end
    const result = await csv({ headers: originalHeaders.map(header => header + '1') }).fromString(event.data.input);
    const parsingInputTimeEnd = performance.now();

    postMessage({
      result: result,
      time: Math.round(parsingInputTimeEnd - parsingInputTimeStart)
    });

  }
  // Parse newline-delimited list of literals
  else {

    const parsingInputTimeStart = performance.now();
    const result = event.data.input
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(literal => literal.toLowerCase().trim())
    .filter(literal => literal !== '');
    const parsingInputTimeEnd = performance.now();

    postMessage({
      result: result,
      time: Math.round(parsingInputTimeEnd - parsingInputTimeStart)
    });

  }

}
