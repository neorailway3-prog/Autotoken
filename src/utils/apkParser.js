import JSZip from 'jszip';

function binarySearchPattern(buffer, patterns) {
  let str = '';
  for (let i = 0; i < buffer.length; i += 65536) {
    str += String.fromCharCode(...buffer.subarray(i, i + 65536));
  }
  const urlMatch = str.match(patterns.url);
  const keyMatch = str.match(patterns.key);
  return {
    url: urlMatch ? urlMatch[0] : '',
    key: keyMatch ? keyMatch[0] : ''
  };
}

export async function parseApk(file) {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  let firebaseUrl = '', apiKey = '', projectId = '', appId = '';
  const urlPattern = /https:\/\/[a-z0-9_-]+\.firebaseio\.com/gi;
  const keyPattern = /AIza[A-Za-z0-9_-]{35}/g;

  const resources = zip.file('resources.arsc');
  if (resources) {
    const data = await resources.async('uint8array');
    const result = binarySearchPattern(data, { url: urlPattern, key: keyPattern });
    if (result.url) firebaseUrl = result.url;
    if (result.key) apiKey = result.key;
  }

  if (!firebaseUrl || !apiKey) {
    const dexFiles = ['classes.dex', 'classes2.dex', 'classes3.dex', 'classes4.dex'];
    for (const name of dexFiles) {
      if (firebaseUrl && apiKey) break;
      const file = zip.file(name);
      if (!file) continue;
      const data = await file.async('uint8array');
      const result = binarySearchPattern(data, { url: urlPattern, key: keyPattern });
      if (!firebaseUrl && result.url) firebaseUrl = result.url;
      if (!apiKey && result.key) apiKey = result.key;
    }
  }

  if (!firebaseUrl || !apiKey) {
    const jsonFiles = [
      zip.file('google-services.json'),
      zip.file('assets/google-services.json'),
      zip.file(/google-services\.json$/i)[0]
    ].filter(Boolean);
    for (const file of jsonFiles) {
      if (file) try {
        const json = JSON.parse(await file.async('text'));
        if (!firebaseUrl) firebaseUrl = json?.project_info?.firebase_url || '';
        if (!projectId) projectId = json?.project_info?.project_id || '';
        const client = json?.client?.[0];
        if (!apiKey) apiKey = client?.api_key?.[0]?.current_key || '';
        if (!appId) appId = client?.client_info?.mobilesdk_app_id || '';
      } catch {}
    }
  }

  if (!firebaseUrl || !apiKey) {
    for (const name of Object.keys(zip.files)) {
      if (firebaseUrl && apiKey) break;
      if (!zip.files[name].dir) try {
        const data = await zip.files[name].async('uint8array');
        const result = binarySearchPattern(data, { url: urlPattern, key: keyPattern });
        if (!firebaseUrl && result.url) firebaseUrl = result.url;
        if (!apiKey && result.key) apiKey = result.key;
      } catch {}
    }
  }

  return (!firebaseUrl && !apiKey) ? null : { firebaseUrl, apiKey, projectId, appId };
}
