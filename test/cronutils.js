'use strict'

const cronutils = require('../src/utils/cronutils');

const assert = require('assert');

describe('cronutils', () => {

  it('should be specials character', () => {
    assert.equal(cronutils.isAllowedSpecialCharacter('seconds', '*'), true);
    assert.equal(cronutils.isAllowedSpecialCharacter('minutes', ','), true);
    assert.equal(cronutils.isAllowedSpecialCharacter('hours', '-'), true);
    assert.equal(cronutils.isAllowedSpecialCharacter('dom', '?'), true);
    assert.equal(cronutils.isAllowedSpecialCharacter('dom', 'L'), true);
    assert.equal(cronutils.isAllowedSpecialCharacter('dom', 'W'), true);
    assert.equal(cronutils.isAllowedSpecialCharacter('dow', '#'), true);
    assert.equal(cronutils.isAllowedSpecialCharacter('dow', 'L'), true);
  });

  it('should not be specials character', () => {
    assert.equal(cronutils.isAllowedSpecialCharacter('seconds', '?'), false);
    assert.equal(cronutils.isAllowedSpecialCharacter('minutes', 'L'), false);
    assert.equal(cronutils.isAllowedSpecialCharacter('hours', 'W'), false);
    assert.equal(cronutils.isAllowedSpecialCharacter('dom', '#'), false);
  });
  
  it('should be a valid CRON expression', () => {
    var valid = '* 30 11 * * 1-5';
    var valid2 = '0 10,44 14 ? 3 WED';
    var valid3 = '0 15 10 ? * MON-FRI';
    assert.equal(cronutils.isValid(valid), true);
    assert.equal(cronutils.isValid(valid2), true);
    assert.equal(cronutils.isValid(valid3), true);
  });

  it('minutes should be *', () => {
    var expr = '* 30 11 * * 1-5';
    var minutes = cronutils.getMinutes(expr);
    assert.equal(minutes, '*');
  });

  it('minutes should be *', () => {
    var expr = '* 30 11 * * 1-5';
    var minutes = cronutils.getMinutes(expr);
    assert.equal(minutes, '*');
  });
})
