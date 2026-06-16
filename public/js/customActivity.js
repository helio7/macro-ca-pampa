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

  function getArgumentValue(inArguments, key) {
    var match = inArguments.find(function (argument) {
      return Object.prototype.hasOwnProperty.call(argument, key);
    });

    return match ? match[key] : '';
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
    console.log('[customActivity] populateForm:start', data);

    var inArguments =
      data &&
      data.arguments &&
      data.arguments.execute &&
      Array.isArray(data.arguments.execute.inArguments)
        ? data.arguments.execute.inArguments
        : [];

    console.log('[customActivity] populateForm:inArguments', inArguments);

    activity = data || activity;

    var dataExtension = getArgumentValue(inArguments, 'dataExtension');
    var phoneColumnName = getArgumentValue(inArguments, 'dataExtensionPhoneNumberColumnName');
    var dniColumnName =
      getArgumentValue(inArguments, 'dataExtensionDniColumnName') ||
      getColumnNameFromAttribute(getArgumentValue(inArguments, 'dni'));
    var genderColumnName =
      getArgumentValue(inArguments, 'dataExtensionGenderColumnName') ||
      getColumnNameFromAttribute(getArgumentValue(inArguments, 'gender'));
    var tributarioColumnName =
      getArgumentValue(inArguments, 'dataExtensionTributarioColumnName') ||
      getColumnNameFromAttribute(getArgumentValue(inArguments, 'tributario'));
    var bsuidColumnName =
      getArgumentValue(inArguments, 'dataExtensionBsuidColumnName') ||
      getColumnNameFromAttribute(getArgumentValue(inArguments, 'bsuid'));
    var campaignName = getArgumentValue(inArguments, 'campaignName');
    var templateId = getArgumentValue(inArguments, 'templateId');
    var variablesValue = getArgumentValue(inArguments, 'variables');

    console.log('[customActivity] populateForm:resolvedValues', {
      dataExtension: dataExtension,
      phoneColumnName: phoneColumnName,
      dniColumnName: dniColumnName,
      genderColumnName: genderColumnName,
      tributarioColumnName: tributarioColumnName,
      bsuidColumnName: bsuidColumnName,
      campaignName: campaignName,
      templateId: templateId,
      variablesValue: variablesValue
    });

    if (dataExtension) {
      byId('dataExtension').value = dataExtension;
    }

    if (phoneColumnName) {
      setNormalizedValue(byId('dataExtensionPhoneNumberColumnName'), phoneColumnName);
    }

    if (campaignName) {
      byId('campaignName').value = campaignName;
    }

    if (templateId) {
      byId('templateId').value = templateId;
    }

    if (dniColumnName) {
      setNormalizedValue(byId('dni'), dniColumnName);
    }

    if (genderColumnName) {
      setNormalizedValue(byId('gender'), genderColumnName);
    }

    if (tributarioColumnName) {
      setNormalizedValue(byId('tributario'), tributarioColumnName);
    }

    if (bsuidColumnName) {
      setNormalizedValue(byId('bsuid'), bsuidColumnName);
    }

    if (variablesValue && variablesValue !== 'NO_VARIABLES') {
      var parsedVariables = deserializeString(variablesValue);

      console.log('[customActivity] populateForm:parsedVariables', parsedVariables);

      Object.keys(parsedVariables).forEach(function (key) {
        var value = parsedVariables[key];
        addVariableRow(getColumnNameFromAttribute(value));
      });
    }

    console.log('[customActivity] populateForm:complete');
  }

  function buildArguments() {
    console.log('[customActivity] buildArguments:start');

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

    console.log('[customActivity] buildArguments:resolvedValues', {
      dataExtension: dataExtension,
      phoneColumnName: phoneColumnName,
      campaignName: campaignName,
      templateId: templateId,
      dniColumnName: dniColumnName,
      genderColumnName: genderColumnName,
      tributarioColumnName: tributarioColumnName,
      bsuidColumnName: bsuidColumnName,
      variables: variables,
      phoneNumber: phoneNumber,
      dni: dni,
      gender: gender,
      tributario: tributario,
      bsuid: bsuid
    });

    var result = [
      { dataExtension: dataExtension || null },
      {
        dataExtensionPhoneNumberColumnName: phoneColumnName || null
      },
      {
        dataExtensionDniColumnName: dniColumnName || null
      },
      {
        dataExtensionGenderColumnName: genderColumnName || null
      },
      {
        dataExtensionTributarioColumnName: tributarioColumnName || null
      },
      {
        dataExtensionBsuidColumnName: bsuidColumnName || null
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

    console.log('[customActivity] buildArguments:result', result);

    return result;
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
    console.log('[customActivity] clickedNext:updateActivity', activity);
    connection.trigger('updateActivity', activity);
  });
});
