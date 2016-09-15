'use strict'

const assert = require('assert');
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

describe('Detect new items', () => {

  const mockList = [
    { modality: 0, description: 'Este é um item de teste hahaha, inútil, sqn :P', date: '10/06/2016' },
    { modality: 3, description: 'Outro inútil hahah', date: '10/07/2016' },
    { modality: 1, description: 'Aff...', date: '10/05/2016' },
    { modality: 4, description: 'O inútil mais diferente de todos.', date: "25/09/2016" },
    { modality: 0, description: 'O último inútil da lista.', date: "20/08/2016" }
  ];

  const lastItemsInDatabase = [
    {
      modality: 0,
      description: 'Este é o último item salvo.',
      date: '10/05/2016'
    },
    {
      modality: 0,
      description: 'Este é o penúltimo item salvo.',
      date: '10/04/2016'
    }
  ];

  describe('New items above', () => {
    it('should have 2 new items at top', () => {
      const testList = [
        mockList[0],
        mockList[4],
        lastItemsInDatabase[0],
        lastItemsInDatabase[1]
      ];

      const lastSavedItemsIndex = getIndexes(testList, lastItemsInDatabase);
      const { first, second } = lastItemsInDatabase;
      if(Math.abs(second - first) === 1 && first !== 0) {
        
        // Copy list
        let newList = [...testList];
        
        // Get the top items
        newList = newList.splice(0, newList.length - firstLastItemIndex);        
        assert.equal(true, isEqual(newList[0], testList[0]));
        assert.equal(true, isEqual(newList[1], testList[1]));
        assert.equal(2, newList.length);
      }
    });
  });

  describe('New items between', () => {
    it('should have 2 new items between the last two in database', () => {
      const testList = [
        lastItemsInDatabase[0],
        mockList[1],
        mockList[0],
        lastItemsInDatabase[1]
      ];

      const lastSavedItemsIndex = getIndexes(testList, lastItemsInDatabase);
      const { first, second } = lastSavedItemsIndex;

      const diff = Math.abs(second - first) - 1;
      if(diff !== 1 && first === 0) {
        let newList = [...testList];
        newList = newList.splice(first + 1, diff);
        assert.equal(true, isEqual(newList[0], testList[1]));
        assert.equal(true, isEqual(newList[1], testList[2]));
        assert.equal(2, newList.length);
      }
    });
  });

  describe('New items between and at top', () => {
    it('should have 4 new items, 2 between the last two in databse and 2 at top', () => {
      const testList = [
        mockList[0],
        mockList[3],
        lastItemsInDatabase[0],
        mockList[1],
        mockList[4],
        lastItemsInDatabase[1],
      ];

      const lastSavedItemsIndex = getIndexes(testList, lastItemsInDatabase);
      const { first, second } = lastSavedItemsIndex;
      const diff = Math.abs(second - first) - 1;
      if(diff !== 1 && first !== 0) {

        const topItems = [...testList].splice(0, first);
        const betweenItems = [...testList].splice(first + 1, diff);

        const newList = topItems.concat(betweenItems);

        // top items
        assert.equal(true, isEqual(newList[0], testList[0]));
        assert.equal(true, isEqual(newList[1], testList[1]));
        // between items
        assert.equal(true, isEqual(newList[2], testList[3]));
        assert.equal(true, isEqual(newList[3], testList[4]));

        assert.equal(2, topItems.length);
        assert.equal(2, betweenItems.length);
        assert.equal(4, newList.length);
      }
    });
  });
});


function getIndexes(list, databaseItems) {
  let indexes = { first: 0, second: 0 };

  list.forEach((item, index) => {
    if(isEqual(item, databaseItems[0])) indexes.first  = index;
    if(isEqual(item, databaseItems[1])) indexes.second = index;
  });

  return indexes;
}


function isEqual(a, b) {
  return a.modality    === b.modality &&
         a.description === b.description &&
         a.date        === b.date;
}