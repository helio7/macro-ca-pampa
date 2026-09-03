'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, 'public');
const configTemplatePath = path.join(publicDir, 'config.template.json');

const VERSION = 12;

const basePath = `/version${VERSION}`;

app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(basePath, express.static(publicDir));

function readConfigTemplate() {
  return JSON.parse(fs.readFileSync(configTemplatePath, 'utf8'));
}

function validateEnvironment() {
  const environmentLabel = (process.env.ENVIRONMENT_LABEL || '').trim();
  const securityContextKey = (process.env.SECURITY_CONTEXT_KEY || '').trim();

  if (!environmentLabel) {
    throw new Error('Missing required environment variable ENVIRONMENT_LABEL.');
  }

  if (!/^[A-Za-z0-9 _-]+$/.test(environmentLabel)) {
    throw new Error('ENVIRONMENT_LABEL contains invalid characters. Allowed: letters, numbers, spaces, hyphens, underscores.');
  }

  if (!securityContextKey) {
    throw new Error('Missing required environment variable SECURITY_CONTEXT_KEY.');
  }

  if (!/^[A-Za-z0-9_-]+$/.test(securityContextKey)) {
    throw new Error('SECURITY_CONTEXT_KEY contains invalid characters. Allowed: letters, numbers, hyphens, underscores.');
  }

  return { environmentLabel, securityContextKey };
}

function buildConfig() {
  const config = readConfigTemplate();
  const baseUrl = (process.env.ENDPOINTS_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '') + basePath;
  const applicationExtensionKey = process.env.SALESFORCE_APPLICATION_EXTENSION_KEY || 'NOT_PROVIDED';
  const { environmentLabel, securityContextKey } = validateEnvironment();

  config.configurationArguments.applicationExtensionKey = applicationExtensionKey;
  config.configurationArguments.save.url = `${baseUrl}/journeybuilder/save`;
  config.configurationArguments.publish.url = `${baseUrl}/journeybuilder/publish`;
  config.configurationArguments.validate.url = `${baseUrl}/journeybuilder/validate`;
  config.configurationArguments.stop.url = `${baseUrl}/journeybuilder/stop`;
  config.configurationArguments.edit = {
    url: `${baseUrl}/journeybuilder/edit`,
    verb: 'POST',
    useJwt: true
  };

  if (process.env.JB_EXECUTE_URL) {
    config.arguments.execute.url = process.env.JB_EXECUTE_URL;
  } else {
    config.arguments.execute.url = `${baseUrl}/journeybuilder/execute`;
  }

  const baseName = config.lang['en-US'].name.replace(/\s*-\s*ENVIRONMENT_LABEL$/, '');
  config.lang['en-US'].name = `${baseName} - ${environmentLabel}`;

  if (config.arguments.execute.securityOptions) {
    config.arguments.execute.securityOptions.securityContextKey = securityContextKey;
  }

  const headers = { 'x-channel': 'SFMC' };
  if (process.env.API_KEY) {
    headers['apikey'] = process.env.API_KEY;
  }
  config.arguments.execute.headers = JSON.stringify(headers);
  config.configurationArguments.validate.headers = JSON.stringify({ 'dylan-version': String(VERSION) });

  return config;
}

const configJson = buildConfig();

function logRequest(name, req) {
  console.log(
    `[${new Date().toISOString()}] Journey Builder ${name.toUpperCase()} request received`,
    JSON.stringify({
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      ips: req.ips,
      forwardedFor: req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      headers: req.headers,
      body: req.body
    }, null, 2)
  );
}

function journeyBuilderAck(name) {
  return (_req, res) => {
    console.log(`Journey Builder ${name.toUpperCase()} request received`);
    res.status(200).json({ ok: true, endpoint: name });
  };
}

function formatFecha(date) {
  const pad = (value) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + 'T' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(':');
}

function buildExecuteResponse(estado, activityInstanceId) {
  return {
    activity_instance_id: activityInstanceId,
    estado,
    fecha: formatFecha(new Date())
  };
}

app.get(`${basePath}/`, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get(`${basePath}/config.json`, (req, res) => {
  console.log(`[config.json] version=${VERSION}`, {
    ip: req.ip,
    ips: req.ips,
    forwardedFor: req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent']
  });
  res.json(configJson);
});

app.post(`${basePath}/journeybuilder/edit`, journeyBuilderAck('edit'));
app.post(`${basePath}/journeybuilder/save`, journeyBuilderAck('save'));
app.post(`${basePath}/journeybuilder/validate`, (req, res) => {
  console.log(`Journey Builder VALIDATE request received`, { 'dylan-version': req.headers['dylan-version'] });
  res.status(200).json({ ok: true, endpoint: 'validate' });
});
app.post(`${basePath}/journeybuilder/publish`, journeyBuilderAck('publish'));
app.post(`${basePath}/journeybuilder/stop`, journeyBuilderAck('stop'));
app.post(`${basePath}/journeybuilder/execute`, (req, res) => {
  logRequest('execute', req);

  const activityInstanceId = req.body && typeof req.body === 'object'
    ? req.body.activityInstanceId
    : null;

  if (!activityInstanceId || typeof activityInstanceId !== 'string') {
    return res.status(422).json(buildExecuteResponse('FAILED', 'ERROR_MISSING_ACTIVITY_INSTANCE_ID'));
  }

  return res.status(200).json(buildExecuteResponse('COMPLETED', activityInstanceId));
});

app.listen(port, () => {
  console.log(`Journey Builder Custom Activity server listening on port ${port}`);
  // console.log('Resolved config.json payload:', JSON.stringify(configJson, null, 2));
});
