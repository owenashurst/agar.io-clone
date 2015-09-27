import chai, {
  expect
}
from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

global.expect = expect;
global.sinon = sinon;

// ensure requiring css not to throw
require.extensions['.css'] = function onRequireCSS () {
  return null;
};
