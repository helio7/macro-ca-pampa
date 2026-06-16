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
        return key + '=' + encodeURIComponent(obj[key]);
      })
      .join(';');
  }

  function deserializeString(str) {
    var result = {};

    str.split(';').forEach(function (pair) {
      var parts = pair.split('=');
      var key = parts.shift();

      if (!key) {
        return;
      }

      result[key] = decodeURIComponent(parts.join('='));
    });

    return result;
  }

  function normalizeColumnName(value) {
    return (value || '').replace(/\s+/g, '');
  }

  function setNormalizedValue(element, value) {
    if (!element) {
      return '';
    }

    var normalizedValue = normalizeColumnName(value);
    element.value = normalizedValue;
    element.classList.toggle('invalid-column-name', /\s/.test(value || ''));

    return normalizedValue;
  }

  function getColumnNameFromAttribute(value) {
    if (!value || typeof value !== 'string') {
      return '';
    }

    return normalizeColumnName(value.split('.').pop().replace('}}', ''));
  }

  function buildContactAttribute(dataExtension, columnName) {
    if (!dataExtension || !columnName) {
      return null;
    }

    return '{{Contact.Attribute."' + dataExtension + '".' + columnName + '}}';
  }

  function addVariableRow(value) {
    if (typeof window.addItem === 'function') {
      window.addItem(normalizeColumnName(value || ''));
    }
  }

  function bindColumnNameNormalization() {
    document.addEventListener('input', function (event) {
      var target = event.target;

      if (!target.classList || !target.classList.contains('column-name-input')) {
        return;
      }

      setNormalizedValue(target, target.value);
    });
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
        setNormalizedValue(
          byId('dataExtensionPhoneNumberColumnName'),
          argument.dataExtensionPhoneNumberColumnName
        );
      }

      if (argument.campaignName) {
        byId('campaignName').value = argument.campaignName;
      }

      if (argument.templateId) {
        byId('templateId').value = argument.templateId;
      }

      if (argument.dni) {
        setNormalizedValue(byId('dni'), getColumnNameFromAttribute(argument.dni));
      }

      if (argument.gender) {
        setNormalizedValue(byId('gender'), getColumnNameFromAttribute(argument.gender));
      }

      if (argument.tributario) {
        setNormalizedValue(byId('tributario'), getColumnNameFromAttribute(argument.tributario));
      }

      if (argument.bsuid) {
        setNormalizedValue(byId('bsuid'), getColumnNameFromAttribute(argument.bsuid));
      }

      if (argument.variables && argument.variables !== 'NO_VARIABLES') {
        var parsedVariables = deserializeString(argument.variables);

        Object.keys(parsedVariables).forEach(function (key) {
          var value = parsedVariables[key];
          addVariableRow(getColumnNameFromAttribute(value));
        });
      }
    });
  }

  function buildArguments() {
    var dataExtension = byId('dataExtension').value;
    var phoneColumnName = setNormalizedValue(
      byId('dataExtensionPhoneNumberColumnName'),
      byId('dataExtensionPhoneNumberColumnName').value
    );
    var campaignName = byId('campaignName').value;
    var templateId = byId('templateId').value;
    var dniColumnName = setNormalizedValue(byId('dni'), byId('dni').value);
    var genderColumnName = setNormalizedValue(byId('gender'), byId('gender').value);
    var tributarioColumnName = setNormalizedValue(byId('tributario'), byId('tributario').value);
    var bsuidColumnName = setNormalizedValue(byId('bsuid'), byId('bsuid').value);
    var phoneNumber = buildContactAttribute(dataExtension, phoneColumnName);
    var dni = buildContactAttribute(dataExtension, dniColumnName);
    var gender = buildContactAttribute(dataExtension, genderColumnName);
    var tributario = buildContactAttribute(dataExtension, tributarioColumnName);
    var bsuid = buildContactAttribute(dataExtension, bsuidColumnName);
    var variables = {};
    var rows = document.querySelectorAll('.variable-item');

    rows.forEach(function (row) {
      var input = row.querySelector('input');
      var variableNumber = row.id.replace('group-', '');
      var normalizedColumnName = setNormalizedValue(input, input.value);
      variables[variableNumber] = buildContactAttribute(dataExtension, normalizedColumnName);
    });

    return [
      { dataExtension: dataExtension || null },
      {
        dataExtensionPhoneNumberColumnName: phoneColumnName || null
      },
      { campaignName: campaignName || null },
      { templateId: templateId || null },
      {
        variables: rows.length ? serializeObject(variables) : 'NO_VARIABLES'
      },
      { phoneNumber: phoneNumber },
      { dni: dni },
      { gender: gender },
      { tributario: tributario },
      { bsuid: bsuid }
    ];
  }

  window.onload = function () {
    bindColumnNameNormalization();
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
