import React from 'react';
import App from '../../app/App.js';
import * as utils from '../utils.js';
import TestUtils from 'react-addons-test-utils';

describe('Components', () => {
  describe('App', () => {
    const component = utils.shallowlyRenderedOutput(<App />);

    it('should have a div as container', () => {
      expect(component.type).to.equal('div');
    });

  });
});
