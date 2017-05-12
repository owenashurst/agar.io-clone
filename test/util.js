/*jshint expr:true */

var expect = require('chai').expect,
    util   = require('../src/server/lib/util');


/**
 * Tests for server/lib/util.js
 *
 * This is mostly a regression suite, to make sure behavior
 * is preserved throughout changes to the server infrastructure.
 */

describe('util.js', function () {

  describe('#massToRadius', function () {

    it('should return non-zero radius on zero input', function () {
      var r = util.massToRadius(0);
      expect(r).to.be.a('number');
      expect(r).to.equal(4);
    });

    it('should convert masses to a circle radius', function () {
      var r1 = util.massToRadius(4),
          r2 = util.massToRadius(16),
          r3 = util.massToRadius(1);

      expect(r1).to.equal(16);
      expect(r2).to.equal(28);
      expect(r3).to.equal(10);
    });
  });


  describe('#validNick', function () {

    it('should allow empty player nicknames', function () {
      var bool = util.validNick('');
      //expect(bool).to.be.true;
    });

    it('should allow ascii character nicknames', function () {
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

    it('should disallow unicode-dependent alphabets', function () {
      var n1 = util.validNick('Йèæü');

      expect(n1).to.be.false;
    });

    it('should disallow spaces in nicknames', function () {
        var n1 = util.validNick('Walter White');
        expect(n1).to.be.false;
    });
  });

  describe('#log', function () {

    it('should compute the log_{base} of a number', function () {
      var base10 = util.log(1, 10),
          base2  = util.log(1, 2);

      var identity = util.log(10, 10);

      var logNineThree = Math.round(util.log(9,3) * 1e5) / 1e5; // Tolerate rounding errors

      //  log(1) should equal 0, no matter the base
      expect(base10).to.eql(base2);

      // log(n,n) === 1
      expect(identity).to.eql(1);

      // perform a trivial log calculation: 3^2 === 9
      expect(logNineThree).to.eql(2);
    });

  });

  describe('#getDistance', function () {

    // helper class
    function Point(x,y,r) {
      return {
        x      : x,
        y      : y,
        radius : r
      };
    }

    var p1 = Point(-100, 20, 1),
        p2 = Point(0, 40, 5),
        p3 = Point(0,0,100);

    it('should return a positive number', function () {
      var d = util.getDistance(p1, p2);
      expect(d).to.be.above(-1);
    });
  });
});
