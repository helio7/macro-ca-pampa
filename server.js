'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, 'public');
const configTemplatePath = path.join(publicDir, 'config.template.json');
const salesforceJwtSecret = process.env.SALESFORCE_JWT_SECRET;

const { verify } = require('jsonwebtoken');

app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

function readConfigTemplate() {
  return JSON.parse(fs.readFileSync(configTemplatePath, 'utf8'));
}

function buildConfig() {
  const config = readConfigTemplate();
  const baseUrl = (process.env.ENDPOINTS_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  const applicationExtensionKey = process.env.SALESFORCE_APPLICATION_EXTENSION_KEY || 'NOT_PROVIDED';

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

  return config;
}

const configJson = buildConfig();

function logRequest(name, req) {
  console.log(
    `[${new Date().toISOString()}] Journey Builder ${name.toUpperCase()} request received`,
    {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      ips: req.ips,
      forwardedFor: req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      headers: req.headers,
      body: req.body
    }
  );
}

function journeyBuilderAck(name) {
  return (req, res) => {
    logRequest(name, req);
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

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/config.json', (_req, res) => {
  res.json(configJson);
});

app.post('/journeybuilder/edit', journeyBuilderAck('edit'));
app.post('/journeybuilder/save', journeyBuilderAck('save'));
app.post('/journeybuilder/validate', journeyBuilderAck('validate'));
app.post('/journeybuilder/publish', journeyBuilderAck('publish'));
app.post('/journeybuilder/stop', journeyBuilderAck('stop'));
app.post('/journeybuilder/execute', express.raw({ type: 'application/jwt' }), (req, res) => {
  logRequest('execute', req);

  const jwtBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

  console.log('POST /execute raw JWT body:', jwtBody);

  if (!jwtBody) {
    return res.status(400).json(buildExecuteResponse('FAILED', 'ERROR_MISSING_JWT_BODY'));
  }

  if (!salesforceJwtSecret) {
    console.error('POST /execute request error: SALESFORCE_JWT_SECRET is not configured.');
    return res.status(500).json(buildExecuteResponse('FAILED', 'ERROR_MISSING_JWT_SECRET'));
  }

  verify(
    jwtBody,
    salesforceJwtSecret,
    { algorithms: ['HS256'], complete: false },
    async (err, decoded) => {
      if (err) {
        console.error('POST /execute request error when decoding.', err);
        return res.status(401).json(buildExecuteResponse('FAILED', 'ERROR_INVALID_JWT'));
      }

      console.log('POST /execute request decoded.', JSON.stringify(decoded));

      const activityInstanceId = decoded && typeof decoded === 'object' ? decoded.activityInstanceId : null;

      if (!activityInstanceId || typeof activityInstanceId !== 'string') {
        return res.status(422).json(buildExecuteResponse('FAILED', 'ERROR_MISSING_ACTIVITY_INSTANCE_ID'));
      }

      return res.status(200).json(buildExecuteResponse('COMPLETED', activityInstanceId));
    }
  );
});

app.listen(port, () => {
  console.log(`Journey Builder Custom Activity server listening on port ${port}`);
  // console.log('Resolved config.json payload:', JSON.stringify(configJson, null, 2));
});
