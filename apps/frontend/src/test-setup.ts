import 'zone.js';
import 'zone.js/testing';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { COMPILER_OPTIONS } from '@angular/core';

getTestBed().initTestEnvironment(
  [BrowserTestingModule],
  platformBrowserTesting([
    {
      provide: COMPILER_OPTIONS,
      useValue: {},
      multi: true,
    },
  ])
);
