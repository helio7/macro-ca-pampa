define(['postmonger'], function (Postmonger) {
  'use strict';

  var connection = new Postmonger.Session();
  var activity = {
    arguments: {
      execute: {
        inArguments: []
      }
    },
    metaData: {}
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function serializeObject(obj) {
    return Object.keys(obj)
      .map(function (key) {
        return key + '=' + obj[key];
      })
      .join(';');
  }

  function deserializeString(str) {
    var result = {};

    str.split(';').forEach(function (pair) {
      var parts = pair.split('=');
      var key = parts.shift();
      result[key] = parts.join('=');
    });

    return result;
  }

  function addVariableRow(value) {
    if (typeof window.addItem === 'function') {
      window.addItem(value || '');
    }
  }

  function populateForm(data) {
    var inArguments =
      data &&
      data.arguments &&
      data.arguments.execute &&
      Array.isArray(data.arguments.execute.inArguments)
        ? data.arguments.execute.inArguments
        : [];

    activity = data || activity;

    inArguments.forEach(function (argument) {
      if (argument.dataExtension) {
        byId('dataExtension').value = argument.dataExtension;
      }

      if (argument.dataExtensionPhoneNumberColumnName) {
        byId('dataExtensionPhoneNumberColumnName').value =
          argument.dataExtensionPhoneNumberColumnName;
      }

      if (argument.campaignName) {
        byId('campaignName').value = argument.campaignName;
      }

      if (argument.templateId) {
        byId('templateId').value = argument.templateId;
      }

      if (argument.variables && argument.variables !== 'NO_VARIABLES') {
        var parsedVariables = deserializeString(argument.variables);

        Object.keys(parsedVariables).forEach(function (key) {
          var value = parsedVariables[key];
          var columnName = value.split('.').pop().replace('}}', '');
          addVariableRow(columnName);
        });
      }
    });
  }

  function buildArguments() {
    var dataExtension = byId('dataExtension').value;
    var phoneColumnName = byId('dataExtensionPhoneNumberColumnName').value;
    var campaignName = byId('campaignName').value;
    var templateId = byId('templateId').value;
    var phoneNumber = '{{Contact.Attribute."' + dataExtension + '".' + phoneColumnName + '}}';
    var variables = {};
    var rows = document.querySelectorAll('.variable-item');

    rows.forEach(function (row) {
      var input = row.querySelector('input');
      var variableNumber = row.id.replace('group-', '');
      variables[variableNumber] =
        '{{Contact.Attribute."' + dataExtension + '".' + input.value + '}}';
    });

    return [
      { dataExtension: dataExtension || null },
      {
        dataExtensionPhoneNumberColumnName: phoneColumnName || null
      },
      { campaignName: campaignName || null },
      { templateId: templateId || null },
      { phoneNumber: dataExtension && phoneColumnName ? phoneNumber : null },
      {
        variables: rows.length ? serializeObject(variables) : 'NO_VARIABLES'
      }
    ];
  }

  window.onload = function () {
    connection.trigger('ready');
    connection.trigger('requestTokens');
    connection.trigger('requestEndpoints');
    connection.trigger('requestTriggerEventDefinition');
    connection.trigger('requestInteraction');
  };

  connection.on('initActivity', populateForm);

  connection.on('clickedNext', function () {
    activity.arguments = activity.arguments || {};
    activity.arguments.execute = activity.arguments.execute || {};
    activity.arguments.execute.inArguments = buildArguments();
    activity.metaData = activity.metaData || {};
    activity.metaData.isConfigured = true;
    connection.trigger('updateActivity', activity);
  });
});
