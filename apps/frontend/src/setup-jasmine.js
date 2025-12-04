/* eslint-env jest */

global.jasmine = {
  createSpyObj: (name, methods) => {
    const obj = {};
    methods.forEach((method) => (obj[method] = jest.fn()));
    return obj;
  },
};

global.spyOn = jest.spyOn;

// Monkey patch jest.fn to support .and.returnValue
const originalFn = jest.fn;
jest.fn = (...args) => {
  const fn = originalFn(...args);
  fn.and = {
    returnValue: (value) => fn.mockReturnValue(value),
  };
  return fn;
};
