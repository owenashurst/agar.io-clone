/*jshint expr:true */

const expect = require('chai').expect;
const util = require('../src/server/lib/util');

/**
 * Tests for server/lib/util.js
 *
 * This is mostly a regression suite, to make sure behavior
 * is preserved throughout changes to the server infrastructure.
 */

describe('util.js', () => {
  describe('massToRadius', () => {
    it('should return non-zero radius on zero input', () => {
      var r = util.massToRadius(0);
      expect(r).to.be.a('number');
      expect(r).to.equal(4);
    });

    it('should convert masses to a circle radius', () => {
      var r1 = util.massToRadius(4),
          r2 = util.massToRadius(16),
          r3 = util.massToRadius(1);

      expect(r1).to.equal(16);
      expect(r2).to.equal(28);
      expect(r3).to.equal(10);
    });
  });

  describe('validNick', () => {
    it.skip('should allow empty player nicknames', () => {
      var bool = util.validNick('');
      expect(bool).to.be.true;
    });

    it('should allow ascii character nicknames', () => {
      var n1 = util.validNick('Walter_White'),
          n2 = util.validNick('Jesse_Pinkman'),
          n3 = util.validNick('hank'),
          n4 = util.validNick('marie_schrader12'),
          n5 = util.validNick('p');

      expect(n1).to.be.true;
      expect(n2).to.be.true;
      expect(n3).to.be.true;
      expect(n4).to.be.true;
      expect(n5).to.be.true;
    });

    it('should disallow unicode-dependent alphabets', () => {
      var n1 = util.validNick('Йèæü');

      expect(n1).to.be.false;
    });

    it('should disallow spaces in nicknames', () => {
        var n1 = util.validNick('Walter White');
        expect(n1).to.be.false;
    });
  });

  describe('log', () => {
    it('should compute the log_{base} of a number', () => {
      const base10 = util.mathLog(1, 10);
      const base2  = util.mathLog(1, 2);
      const identity = util.mathLog(10, 10);
      const logNineThree = Math.round(util.mathLog(9,3) * 1e5) / 1e5; // Tolerate rounding errors

      // log(1) should equal 0, no matter the base
      expect(base10).to.eql(base2);

      // log(n,n) === 1
      expect(identity).to.eql(1);

      // perform a trivial log calculation: 3^2 === 9
      expect(logNineThree).to.eql(2);
    });

  });

  describe('getDistance', () => {
    const Point = (x, y, r) => {
      return {
        x,
        y,
        radius: r
      };
    }

    const p1 = Point(-100, 20, 1);
    const p2 = Point(0, 40, 5);

    it('should return a positive number', () => {
      var distance = util.getDistance(p1, p2);
      expect(distance).to.be.above(-1);
    });
  });
});
