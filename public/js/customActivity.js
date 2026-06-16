define(['postmonger'], (Postmonger) => {
    'use strict';

    let $ = jQuery.noConflict();
    let connection = new Postmonger.Session();
    let activity = {};
    let eventDefinitionKey;

    function normalizeColumnName(value) {
        return (value || '').replace(/\s+/g, '');
    }

    function setNormalizedValue(element, value) {
        if (!element) {
            return '';
        }

        const normalizedValue = normalizeColumnName(value);
        element.value = normalizedValue;
        element.classList.toggle('invalid-column-name', /\s/.test(value || ''));
        return normalizedValue;
    }

    function getArgumentValue(inArguments, key) {
        const argument = inArguments.find((item) => Object.prototype.hasOwnProperty.call(item, key));
        return argument ? argument[key] : '';
    }

    function buildContactAttribute(dataExtension, columnName) {
        if (!dataExtension || !columnName) {
            return null;
        }

        return `{{Contact.Attribute."${dataExtension}".${columnName}}}`;
    }

    $(window).ready(() => {
        connection.trigger('ready');
        connection.trigger('requestTokens');
        connection.trigger('requestEndpoints');
        connection.trigger('requestTriggerEventDefinition');
        connection.trigger('requestInteraction');
    });

    connection.on('initActivity', (data) => {
        if (data) {
            activity = data;
        }

        const inArguments = Boolean(
            data &&
            data.arguments &&
            data.arguments.execute &&
            data.arguments.execute.inArguments &&
            data.arguments.execute.inArguments.length > 0
        ) ? data.arguments.execute.inArguments : [];

        const dataExtension = getArgumentValue(inArguments, 'dataExtension');
        const dataExtensionPhoneNumberColumnName = getArgumentValue(inArguments, 'dataExtensionPhoneNumberColumnName');
        const dataExtensionDniColumnName = getArgumentValue(inArguments, 'dataExtensionDniColumnName');
        const dataExtensionGenderColumnName = getArgumentValue(inArguments, 'dataExtensionGenderColumnName');
        const dataExtensionTributarioColumnName = getArgumentValue(inArguments, 'dataExtensionTributarioColumnName');
        const dataExtensionBsuidColumnName = getArgumentValue(inArguments, 'dataExtensionBsuidColumnName');
        const campaignName = getArgumentValue(inArguments, 'campaignName');
        const templateId = getArgumentValue(inArguments, 'templateId');
        const variablesValue = getArgumentValue(inArguments, 'variables');

        if (dataExtension) document.getElementById('dataExtension').value = dataExtension;
        if (dataExtensionPhoneNumberColumnName) setNormalizedValue(document.getElementById('dataExtensionPhoneNumberColumnName'), dataExtensionPhoneNumberColumnName);
        if (dataExtensionDniColumnName) setNormalizedValue(document.getElementById('dni'), dataExtensionDniColumnName);
        if (dataExtensionGenderColumnName) setNormalizedValue(document.getElementById('gender'), dataExtensionGenderColumnName);
        if (dataExtensionTributarioColumnName) setNormalizedValue(document.getElementById('tributario'), dataExtensionTributarioColumnName);
        if (dataExtensionBsuidColumnName) setNormalizedValue(document.getElementById('bsuid'), dataExtensionBsuidColumnName);
        if (campaignName) document.getElementById('campaignName').value = campaignName;
        if (templateId) document.getElementById('templateId').value = templateId;

        if (variablesValue && variablesValue !== 'NO_VARIABLES') {
            const parsedVariables = deserializeString(variablesValue);

            for (const parsedVariable in parsedVariables) {
                addItem(parsedVariables[parsedVariable].split('.').pop()?.replace('}}', ''));
            }
        }
    });

    connection.on('clickedNext', () => {
        const dataExtension = document.getElementById('dataExtension').value;
        const dataExtensionPhoneNumberColumnName = setNormalizedValue(
            document.getElementById('dataExtensionPhoneNumberColumnName'),
            document.getElementById('dataExtensionPhoneNumberColumnName').value,
        );
        const dataExtensionDniColumnName = setNormalizedValue(
            document.getElementById('dni'),
            document.getElementById('dni').value,
        );
        const dataExtensionGenderColumnName = setNormalizedValue(
            document.getElementById('gender'),
            document.getElementById('gender').value,
        );
        const dataExtensionTributarioColumnName = setNormalizedValue(
            document.getElementById('tributario'),
            document.getElementById('tributario').value,
        );
        const dataExtensionBsuidColumnName = setNormalizedValue(
            document.getElementById('bsuid'),
            document.getElementById('bsuid').value,
        );
        const campaignName = document.getElementById('campaignName').value;
        const templateId = document.getElementById('templateId').value;
        const phoneNumber = buildContactAttribute(dataExtension, dataExtensionPhoneNumberColumnName);
        const dni = buildContactAttribute(dataExtension, dataExtensionDniColumnName);
        const gender = buildContactAttribute(dataExtension, dataExtensionGenderColumnName);
        const tributario = buildContactAttribute(dataExtension, dataExtensionTributarioColumnName);
        const bsuid = buildContactAttribute(dataExtension, dataExtensionBsuidColumnName);

        const groupDivs = document.querySelectorAll('.variable-item');
        const variablesObject = {};
        for (const groupDiv of groupDivs) {
            const input = groupDiv.querySelector('input');
            const variableNumber = groupDiv.id.split('group-')[1];
            const dataExtensionColumnName = setNormalizedValue(input, input.value);
            variablesObject[variableNumber] = buildContactAttribute(dataExtension, dataExtensionColumnName);
        }
        const variables = groupDivs.length ? serializeObject(variablesObject) : 'NO_VARIABLES';

        activity['arguments'] = activity['arguments'] || {};
        activity['arguments'].execute = activity['arguments'].execute || {};
        activity['arguments'].execute.inArguments = [
            { dataExtension: dataExtension ? dataExtension : null },
            { dataExtensionPhoneNumberColumnName: dataExtensionPhoneNumberColumnName ? dataExtensionPhoneNumberColumnName : null },
            { dataExtensionDniColumnName: dataExtensionDniColumnName ? dataExtensionDniColumnName : null },
            { dataExtensionGenderColumnName: dataExtensionGenderColumnName ? dataExtensionGenderColumnName : null },
            { dataExtensionTributarioColumnName: dataExtensionTributarioColumnName ? dataExtensionTributarioColumnName : null },
            { dataExtensionBsuidColumnName: dataExtensionBsuidColumnName ? dataExtensionBsuidColumnName : null },
            { campaignName: campaignName ? campaignName : null },
            { templateId: templateId ? templateId : null },
            { phoneNumber: phoneNumber ? phoneNumber : null },
            { dni: dni ? dni : null },
            { gender: gender ? gender : null },
            { tributario: tributario ? tributario : null },
            { bsuid: bsuid ? bsuid : null },
            { variables: variables ? variables : null },
        ];

        activity['metaData'] = activity['metaData'] || {};
        activity['metaData'].isConfigured = true;

        connection.trigger('updateActivity', activity);
    });

    connection.on('requestedTriggerEventDefinition', (eventDefinitionModel) => {
        if (eventDefinitionModel) eventDefinitionKey = eventDefinitionModel.eventDefinitionKey;
    });
});

function serializeObject(obj) {
    return Object.entries(obj)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join(';');
}

function deserializeString(str) {
    const result = {};
    str.split(';').forEach(pair => {
      const [key, ...rest] = pair.split('=');
      if (!key) {
        return;
      }
      result[key] = decodeURIComponent(rest.join('='));
    });
    return result;
}
