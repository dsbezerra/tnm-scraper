'use strict'

const assert = require('assert');
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const Result  = require('../src/models/result');
const Scraper = require('../src/models/scraper');

describe('Database', () => {

  let scraperId, resultId;
  
  describe('Open connection', () => {
    it('should connect successfully if database exists and credentials is valid', (done) => {

      const user = 'scraper';
      const pwd = '123456';
      
      const uri =
        `mongodb://${user}:${pwd}@localhost:27017/tnm`;
      
      mongoose.connect(uri, (err) => {
        if(err) done(err);
        else {
          done();
        }
      });
    });
  });

  describe('Scraper insert', () => {
    it('should insert a Scraper with name \'test\' and city \'São Paulo\'', (done) => {
      
      Scraper.create({
        name: 'test',
        city: 'São Paulo',
      }, (err, scraper) => {
        if(err) done(err);
        else {
          assert.equal('test', scraper.name);
          assert.equal('São Paulo', scraper.city);
          scraperId = scraper._id;
          done();
        }
      });
    });
  });

  describe('Scraper find', () => {
    it('should find scrapers with name \'test\'', (done) => {
      Scraper.find({
        name: 'test'
      }, (err, scraper) => {
        if(err) done(err);
        else done();
      });
    });
  });

  describe('Result insert', () => {
    it('should insert a result with number \'000/0000\' and website \'http://test.com/\'', (done) => {
      Result.create({
        modality: 0,
        number: '000/0000',
        agency: 'test',
        date: new Date('2016-09-14'),
        description: 'test',
        download: {
          relativeUri: '/test.docx',
          uri: 'http://www.test.com/test.docx',
          fileName: 'test.docx',
          fileFormat: 'docx'
        },
        approved: false,
        website: 'http://test.com/details?num=000/0000',
        scraper: scraperId
      }, (err, result) => {
        if(err) done(err);
        else {
          assert.equal('000/0000', result.number);
          assert.equal('http://test.com/details?num=000/0000', result.website);
          resultId = result._id;
          done();
        }
      })
    });
  });

  describe('Scraper update', () => {
    it('should update scraper \'test\' newest result', (done) => {
      Scraper.update({
        name: 'test'
      }, {
        newestResult: resultId
      }, (err, raw) => {
        if(err) done(err);
        else {
          done();
        }
      });
    });
  });

  describe('Remove all scrapers', () => {
    it('should remove all scrapers in database', (done) => {
      Scraper.remove({}, (err) => {
        if(err) done(err);
        else done();
      });
    });
  });

  describe('Remove all results', () => {
    it('should remove all results in database', (done) => {
      Result.remove({}, (err) => {
        if(err) done(err);
        else done();
      });
    });
  });

  describe('Close connection', () => {
    it('should close connection successfully if it\'s open', (done) => {
      mongoose.disconnect((err) => {
        if(err) done(err);
        else done();
      })
    });
  });  
});