/// <reference lib="webworker" />
import { ParseMessageEvent } from '@models/common';
import csv from 'csvtojson';

addEventListener('message', async (event: ParseMessageEvent) => {

  // Parse CSV file
  if ( event.data.csv ) {

    const parsingInputTimeStart = performance.now();
    const result = await csv().fromString(event.data.input);
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

});
