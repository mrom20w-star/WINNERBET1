import { spawn } from 'child_process';
import path from 'path';
import { IncomingMessage, ServerResponse } from 'http';

export function createPhpMiddleware() {
  const adminScriptPath = path.resolve(process.cwd(), 'admin/index.php');

  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';
    const cleanUrl = url.split('?')[0];

    // Check if this request is targeting the PHP admin dashboard
    const isPhpRequest =
      cleanUrl === '/admin' ||
      cleanUrl === '/admin/' ||
      cleanUrl === '/admin/index.php' ||
      cleanUrl === '/admin.php' ||
      cleanUrl.endsWith('.php');

    if (!isPhpRequest) {
      return next();
    }

    const queryIndex = url.indexOf('?');
    const queryString = queryIndex !== -1 ? url.slice(queryIndex + 1) : '';

    // Collect request body
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

    req.on('end', () => {
      const bodyBuffer = Buffer.concat(chunks);

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        REDIRECT_STATUS: '200',
        SCRIPT_FILENAME: adminScriptPath,
        REQUEST_METHOD: req.method || 'GET',
        QUERY_STRING: queryString,
        CONTENT_TYPE: (req.headers['content-type'] as string) || '',
        CONTENT_LENGTH: bodyBuffer.length.toString(),
        HTTP_HOST: (req.headers['host'] as string) || 'localhost:3000',
        HTTP_USER_AGENT: (req.headers['user-agent'] as string) || '',
        HTTP_ACCEPT: (req.headers['accept'] as string) || '*/*',
        SERVER_PROTOCOL: 'HTTP/1.1',
        GATEWAY_INTERFACE: 'CGI/1.1',
      };

      const php = spawn('php-cgi', [], { env });

      if (bodyBuffer.length > 0) {
        php.stdin.write(bodyBuffer);
      }
      php.stdin.end();

      const outputChunks: Buffer[] = [];
      php.stdout.on('data', (data) => outputChunks.push(Buffer.from(data)));

      php.stderr.on('data', (err) => {
        console.error('PHP CGI Stderr:', err.toString());
      });

      php.on('close', (code) => {
        const fullOutput = Buffer.concat(outputChunks);
        const headerEnd = fullOutput.indexOf('\r\n\r\n');
        const headerEndAlt = fullOutput.indexOf('\n\n');

        let headerString = '';
        let bodyBuffer = Buffer.alloc(0);

        if (headerEnd !== -1) {
          headerString = fullOutput.subarray(0, headerEnd).toString('utf-8');
          bodyBuffer = fullOutput.subarray(headerEnd + 4);
        } else if (headerEndAlt !== -1) {
          headerString = fullOutput.subarray(0, headerEndAlt).toString('utf-8');
          bodyBuffer = fullOutput.subarray(headerEndAlt + 2);
        } else {
          bodyBuffer = fullOutput;
        }

        // Parse CGI headers
        let statusCode = 200;
        const lines = headerString.split(/\r?\n/);
        for (const line of lines) {
          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1) {
            const name = line.substring(0, colonIdx).trim().toLowerCase();
            const value = line.substring(colonIdx + 1).trim();
            if (name === 'status') {
              const parsedCode = parseInt(value.split(' ')[0], 10);
              if (!isNaN(parsedCode)) statusCode = parsedCode;
            } else if (name === 'location') {
              statusCode = 302;
              res.setHeader('Location', value);
            } else {
              res.setHeader(name, value);
            }
          }
        }

        res.statusCode = statusCode;
        res.end(bodyBuffer);
      });

      php.on('error', (err) => {
        console.error('PHP CGI Spawn Error:', err);
        res.statusCode = 500;
        res.end('PHP CGI Execution Error: ' + err.message);
      });
    });
  };
}
