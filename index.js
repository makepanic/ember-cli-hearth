/* jshint node: true */
'use strict';

module.exports = {
  name: 'ember-cli-hearth',

  includedCommands: function() {
    return {
      'hearth':       require('./lib/commands/hearth')
    };
  }
};
