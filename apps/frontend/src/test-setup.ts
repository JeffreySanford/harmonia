// Test setup for Angular/Jest
// Zone.js dependencies
// Attempt to import zone.js core and testing; older or newer versions may have differing paths.
import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
