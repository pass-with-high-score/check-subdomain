import { NextRequest, NextResponse } from 'next/server';

interface RequestData {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string | null;
    isBinary: boolean;
    language: string;
    variant: string;
}

// Generate curl command
function toCurl(data: RequestData): string {
    let cmd = '';

    if (data.body && data.isBinary) {
        cmd = `echo '${data.body}' | base64 -d | curl -X ${data.method} '${data.url}'`;
    } else {
        cmd = `curl -X ${data.method} '${data.url}'`;
    }

    for (const [key, value] of Object.entries(data.headers)) {
        const escapedValue = value.replace(/'/g, "'\\''");
        cmd += ` \\\n  -H '${key}: ${escapedValue}'`;
    }

    if (data.body) {
        if (data.isBinary) {
            cmd += ` \\\n  --data-binary @-`;
        } else {
            const escapedBody = data.body.replace(/'/g, "'\\''");
            cmd += ` \\\n  -d '${escapedBody}'`;
        }
    }

    return cmd;
}

// Generate wget code
function toWget(data: RequestData): string {
    let cmd = '';

    if (data.body && data.isBinary) {
        cmd = `echo '${data.body}' | base64 -d | wget --method=${data.method}`;
    } else {
        cmd = `wget --method=${data.method}`;
    }

    for (const [key, value] of Object.entries(data.headers)) {
        cmd += ` \\\n  --header='${key}: ${value}'`;
    }

    if (data.body) {
        if (data.isBinary) {
            cmd += ` \\\n  --body-file=-`;
        } else {
            cmd += ` \\\n  --body-data='${data.body}'`;
        }
    }

    cmd += ` \\\n  '${data.url}'`;

    return cmd;
}

// Generate HTTPie code
function toHttpie(data: RequestData): string {
    let cmd = '';

    if (data.body && data.isBinary) {
        cmd = `echo '${data.body}' | base64 -d | http ${data.method} '${data.url}'`;
    } else {
        cmd = `http ${data.method} '${data.url}'`;
    }

    for (const [key, value] of Object.entries(data.headers)) {
        cmd += ` \\\n  '${key}:${value}'`;
    }

    if (data.body && !data.isBinary) {
        try {
            const jsonData = JSON.parse(data.body);
            for (const [key, value] of Object.entries(jsonData)) {
                cmd += ` \\\n  ${key}='${value}'`;
            }
        } catch {
            cmd += ` \\\n  --raw='${data.body}'`;
        }
    }

    return cmd;
}

// Generate PowerShell code
function toPowershell(data: RequestData): string {
    let code = '';

    if (Object.keys(data.headers).length > 0) {
        code += '$headers = @{\n';
        for (const [key, value] of Object.entries(data.headers)) {
            code += `    '${key}' = '${value}'\n`;
        }
        code += '}\n\n';
    }

    if (data.body) {
        if (data.isBinary) {
            code += `$bodyBase64 = '${data.body}'\n`;
            code += '$bodyBytes = [Convert]::FromBase64String($bodyBase64)\n\n';
        } else {
            code += `$body = '${data.body.replace(/'/g, "''")}'\n\n`;
        }
    }

    code += 'Invoke-RestMethod `\n';
    code += `    -Uri '${data.url}' \`\n`;
    code += `    -Method ${data.method}`;

    if (Object.keys(data.headers).length > 0) {
        code += ' `\n    -Headers $headers';
    }

    if (data.body) {
        if (data.isBinary) {
            code += ' `\n    -Body $bodyBytes';
        } else {
            code += ' `\n    -Body $body';
        }
    }

    return code;
}

// Generate Python requests code
function toPython(data: RequestData): string {
    let code = 'import requests\n';
    if (data.isBinary) {
        code += 'import base64\n';
    }
    code += '\n';

    if (Object.keys(data.headers).length > 0) {
        code += 'headers = {\n';
        for (const [key, value] of Object.entries(data.headers)) {
            code += `    '${key}': '${value}',\n`;
        }
        code += '}\n\n';
    }

    if (data.body) {
        if (data.isBinary) {
            code += `body_base64 = '${data.body}'\n`;
            code += 'body = base64.b64decode(body_base64)\n\n';
        } else {
            code += `data = '${data.body.replace(/'/g, "\\'")}'\n\n`;
        }
    }

    code += `response = requests.${data.method.toLowerCase()}(\n`;
    code += `    '${data.url}',\n`;

    if (Object.keys(data.headers).length > 0) {
        code += '    headers=headers,\n';
    }

    if (data.body) {
        if (data.isBinary) {
            code += '    data=body,\n';
        } else {
            code += '    data=data,\n';
        }
    }

    code += ')\n';
    code += 'print(response.text)';

    return code;
}

// Generate JavaScript fetch code
function toJavaScriptFetch(data: RequestData): string {
    let code = '';

    if (data.isBinary && data.body) {
        code += `// Decode base64 body\n`;
        code += `const base64Body = '${data.body}';\n`;
        code += `const binaryBody = atob(base64Body);\n`;
        code += `const bytes = new Uint8Array(binaryBody.length);\n`;
        code += `for (let i = 0; i < binaryBody.length; i++) {\n`;
        code += `    bytes[i] = binaryBody.charCodeAt(i);\n`;
        code += `}\n\n`;
    }

    code += `fetch('${data.url}', {\n`;
    code += `    method: '${data.method}',\n`;

    if (Object.keys(data.headers).length > 0) {
        code += '    headers: {\n';
        for (const [key, value] of Object.entries(data.headers)) {
            code += `        '${key}': '${value}',\n`;
        }
        code += '    },\n';
    }

    if (data.body) {
        if (data.isBinary) {
            code += '    body: bytes,\n';
        } else {
            code += `    body: ${JSON.stringify(data.body)},\n`;
        }
    }

    code += '})\n';
    code += '    .then(response => response.text())\n';
    code += '    .then(data => console.log(data))\n';
    code += '    .catch(error => console.error(error));';

    return code;
}

// Generate JavaScript XHR code
function toJavaScriptXHR(data: RequestData): string {
    let code = '';

    if (data.isBinary && data.body) {
        code += `// Decode base64 body\n`;
        code += `const base64Body = '${data.body}';\n`;
        code += `const binaryBody = atob(base64Body);\n`;
        code += `const bytes = new Uint8Array(binaryBody.length);\n`;
        code += `for (let i = 0; i < binaryBody.length; i++) {\n`;
        code += `    bytes[i] = binaryBody.charCodeAt(i);\n`;
        code += `}\n\n`;
    }

    code += 'const xhr = new XMLHttpRequest();\n';
    code += `xhr.open('${data.method}', '${data.url}');\n\n`;

    for (const [key, value] of Object.entries(data.headers)) {
        code += `xhr.setRequestHeader('${key}', '${value}');\n`;
    }

    code += '\nxhr.onload = function() {\n';
    code += '    console.log(xhr.responseText);\n';
    code += '};\n\n';

    if (data.body) {
        if (data.isBinary) {
            code += 'xhr.send(bytes);';
        } else {
            code += `xhr.send(${JSON.stringify(data.body)});`;
        }
    } else {
        code += 'xhr.send();';
    }

    return code;
}

// Generate Axios code
function toAxios(data: RequestData): string {
    let code = "const axios = require('axios');\n";

    if (data.isBinary && data.body) {
        code += `\n// Decode base64 body\n`;
        code += `const base64Body = '${data.body}';\n`;
        code += `const body = Buffer.from(base64Body, 'base64');\n`;
    }
    code += '\n';

    code += 'axios({\n';
    code += `    method: '${data.method.toLowerCase()}',\n`;
    code += `    url: '${data.url}',\n`;

    if (Object.keys(data.headers).length > 0) {
        code += '    headers: {\n';
        for (const [key, value] of Object.entries(data.headers)) {
            code += `        '${key}': '${value}',\n`;
        }
        code += '    },\n';
    }

    if (data.body) {
        if (data.isBinary) {
            code += '    data: body,\n';
        } else {
            code += `    data: ${JSON.stringify(data.body)},\n`;
        }
    }

    code += '})\n';
    code += '    .then(response => console.log(response.data))\n';
    code += '    .catch(error => console.error(error));';

    return code;
}

// Generate Go code
function toGo(data: RequestData): string {
    let code = 'package main\n\n';
    code += 'import (\n';
    if (data.isBinary) {
        code += '    "encoding/base64"\n';
    }
    code += '    "fmt"\n';
    code += '    "io"\n';
    code += '    "net/http"\n';
    if (data.body) {
        code += '    "bytes"\n';
    }
    code += ')\n\n';

    code += 'func main() {\n';

    if (data.body) {
        if (data.isBinary) {
            code += `    base64Body := "${data.body}"\n`;
            code += '    bodyBytes, _ := base64.StdEncoding.DecodeString(base64Body)\n';
            code += '    body := bytes.NewReader(bodyBytes)\n';
        } else {
            code += `    body := bytes.NewReader([]byte(\`${data.body}\`))\n`;
        }
        code += `    req, _ := http.NewRequest("${data.method}", "${data.url}", body)\n`;
    } else {
        code += `    req, _ := http.NewRequest("${data.method}", "${data.url}", nil)\n`;
    }

    for (const [key, value] of Object.entries(data.headers)) {
        code += `    req.Header.Set("${key}", "${value}")\n`;
    }

    code += '\n    client := &http.Client{}\n';
    code += '    resp, _ := client.Do(req)\n';
    code += '    defer resp.Body.Close()\n\n';
    code += '    respBody, _ := io.ReadAll(resp.Body)\n';
    code += '    fmt.Println(string(respBody))\n';
    code += '}';

    return code;
}

// Generate PHP code
function toPhp(data: RequestData): string {
    let code = '<?php\n\n';
    code += '$ch = curl_init();\n\n';
    code += `curl_setopt($ch, CURLOPT_URL, '${data.url}');\n`;
    code += 'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n';
    code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${data.method}');\n\n`;

    if (Object.keys(data.headers).length > 0) {
        code += 'curl_setopt($ch, CURLOPT_HTTPHEADER, [\n';
        for (const [key, value] of Object.entries(data.headers)) {
            code += `    '${key}: ${value}',\n`;
        }
        code += ']);\n\n';
    }

    if (data.body) {
        if (data.isBinary) {
            code += `$bodyBase64 = '${data.body}';\n`;
            code += '$body = base64_decode($bodyBase64);\n';
            code += 'curl_setopt($ch, CURLOPT_POSTFIELDS, $body);\n\n';
        } else {
            code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${data.body.replace(/'/g, "\\'")}');\n\n`;
        }
    }

    code += '$response = curl_exec($ch);\n';
    code += 'curl_close($ch);\n\n';
    code += 'echo $response;';

    return code;
}

// Generate Ruby code
function toRuby(data: RequestData): string {
    let code = "require 'net/http'\n";
    code += "require 'uri'\n";
    if (data.isBinary) {
        code += "require 'base64'\n";
    }
    code += '\n';

    code += `uri = URI.parse('${data.url}')\n`;
    code += 'http = Net::HTTP.new(uri.host, uri.port)\n';
    code += 'http.use_ssl = true if uri.scheme == "https"\n\n';

    code += `request = Net::HTTP::${data.method.charAt(0) + data.method.slice(1).toLowerCase()}.new(uri.request_uri)\n`;

    for (const [key, value] of Object.entries(data.headers)) {
        code += `request['${key}'] = '${value}'\n`;
    }

    if (data.body) {
        if (data.isBinary) {
            code += `request.body = Base64.decode64('${data.body}')\n`;
        } else {
            code += `request.body = '${data.body.replace(/'/g, "\\'")}'\n`;
        }
    }

    code += '\nresponse = http.request(request)\n';
    code += 'puts response.body';

    return code;
}

// Generate Java code
function toJava(data: RequestData): string {
    let code = 'import java.net.http.HttpClient;\n';
    code += 'import java.net.http.HttpRequest;\n';
    code += 'import java.net.http.HttpResponse;\n';
    code += 'import java.net.URI;\n';
    if (data.isBinary) {
        code += 'import java.util.Base64;\n';
    }
    code += '\n';

    code += 'public class Main {\n';
    code += '    public static void main(String[] args) throws Exception {\n';
    code += '        HttpClient client = HttpClient.newHttpClient();\n\n';

    if (data.body && data.isBinary) {
        code += `        String base64Body = "${data.body}";\n`;
        code += '        byte[] bodyBytes = Base64.getDecoder().decode(base64Body);\n\n';
    }

    code += '        HttpRequest request = HttpRequest.newBuilder()\n';
    code += `            .uri(URI.create("${data.url}"))\n`;
    code += `            .method("${data.method}", `;

    if (data.body) {
        if (data.isBinary) {
            code += 'HttpRequest.BodyPublishers.ofByteArray(bodyBytes))\n';
        } else {
            code += `HttpRequest.BodyPublishers.ofString("${data.body.replace(/"/g, '\\"')}"))\n`;
        }
    } else {
        code += 'HttpRequest.BodyPublishers.noBody())\n';
    }

    for (const [key, value] of Object.entries(data.headers)) {
        code += `            .header("${key}", "${value}")\n`;
    }

    code += '            .build();\n\n';
    code += '        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\n';
    code += '        System.out.println(response.body());\n';
    code += '    }\n';
    code += '}';

    return code;
}

// Generate C# code
function toCSharp(data: RequestData): string {
    let code = 'using System;\n';
    code += 'using System.Net.Http;\n';
    code += 'using System.Threading.Tasks;\n\n';

    code += 'class Program\n{\n';
    code += '    static async Task Main()\n    {\n';
    code += '        using var client = new HttpClient();\n\n';

    code += `        var request = new HttpRequestMessage(HttpMethod.${data.method.charAt(0) + data.method.slice(1).toLowerCase()}, "${data.url}");\n`;

    for (const [key, value] of Object.entries(data.headers)) {
        code += `        request.Headers.Add("${key}", "${value}");\n`;
    }

    if (data.body) {
        if (data.isBinary) {
            code += `        var base64Body = "${data.body}";\n`;
            code += '        var bodyBytes = Convert.FromBase64String(base64Body);\n';
            code += '        request.Content = new ByteArrayContent(bodyBytes);\n';
        } else {
            code += `        request.Content = new StringContent("${data.body.replace(/"/g, '\\"')}");\n`;
        }
    }

    code += '\n        var response = await client.SendAsync(request);\n';
    code += '        Console.WriteLine(await response.Content.ReadAsStringAsync());\n';
    code += '    }\n}';

    return code;
}

// Generate Kotlin code
function toKotlin(data: RequestData): string {
    let code = 'import java.net.http.HttpClient\n';
    code += 'import java.net.http.HttpRequest\n';
    code += 'import java.net.http.HttpResponse\n';
    code += 'import java.net.URI\n';
    if (data.isBinary) {
        code += 'import java.util.Base64\n';
    }
    code += '\n';

    code += 'fun main() {\n';
    code += '    val client = HttpClient.newHttpClient()\n\n';

    if (data.body && data.isBinary) {
        code += `    val base64Body = "${data.body}"\n`;
        code += '    val bodyBytes = Base64.getDecoder().decode(base64Body)\n\n';
    }

    code += '    val request = HttpRequest.newBuilder()\n';
    code += `        .uri(URI.create("${data.url}"))\n`;
    code += `        .method("${data.method}", `;

    if (data.body) {
        if (data.isBinary) {
            code += 'HttpRequest.BodyPublishers.ofByteArray(bodyBytes))\n';
        } else {
            code += `HttpRequest.BodyPublishers.ofString("${data.body.replace(/"/g, '\\"')}"))\n`;
        }
    } else {
        code += 'HttpRequest.BodyPublishers.noBody())\n';
    }

    for (const [key, value] of Object.entries(data.headers)) {
        code += `        .header("${key}", "${value}")\n`;
    }

    code += '        .build()\n\n';
    code += '    val response = client.send(request, HttpResponse.BodyHandlers.ofString())\n';
    code += '    println(response.body())\n';
    code += '}';

    return code;
}

// Generate Rust code
function toRust(data: RequestData): string {
    let code = 'use reqwest;\n';
    if (data.isBinary) {
        code += 'use base64::Engine;\n';
    }
    code += '\n';
    code += '#[tokio::main]\n';
    code += 'async fn main() -> Result<(), Box<dyn std::error::Error>> {\n';
    code += '    let client = reqwest::Client::new();\n\n';

    if (data.body && data.isBinary) {
        code += `    let base64_body = "${data.body}";\n`;
        code += '    let body_bytes = base64::engine::general_purpose::STANDARD.decode(base64_body)?;\n\n';
    }

    code += `    let response = client.${data.method.toLowerCase()}("${data.url}")\n`;

    for (const [key, value] of Object.entries(data.headers)) {
        code += `        .header("${key}", "${value}")\n`;
    }

    if (data.body) {
        if (data.isBinary) {
            code += '        .body(body_bytes)\n';
        } else {
            code += `        .body("${data.body.replace(/"/g, '\\"')}")\n`;
        }
    }

    code += '        .send()\n';
    code += '        .await?;\n\n';
    code += '    println!("{}", response.text().await?);\n';
    code += '    Ok(())\n';
    code += '}';

    return code;
}

// Generate Dart code
function toDart(data: RequestData): string {
    let code = "import 'package:http/http.dart' as http;\n";
    if (data.isBinary) {
        code += "import 'dart:convert';\n";
    }
    code += '\n';
    code += 'void main() async {\n';

    if (data.body && data.isBinary) {
        code += `    final base64Body = '${data.body}';\n`;
        code += '    final bodyBytes = base64.decode(base64Body);\n\n';
    }

    code += `    final response = await http.${data.method.toLowerCase()}(\n`;
    code += `        Uri.parse('${data.url}'),\n`;

    if (Object.keys(data.headers).length > 0) {
        code += '        headers: {\n';
        for (const [key, value] of Object.entries(data.headers)) {
            code += `            '${key}': '${value}',\n`;
        }
        code += '        },\n';
    }

    if (data.body) {
        if (data.isBinary) {
            code += '        body: bodyBytes,\n';
        } else {
            code += `        body: '${data.body.replace(/'/g, "\\'")}',\n`;
        }
    }

    code += '    );\n\n';
    code += '    print(response.body);\n';
    code += '}';

    return code;
}

// Generate R code
function toR(data: RequestData): string {
    let code = 'library(httr)\n';
    if (data.isBinary) {
        code += 'library(base64enc)\n';
    }
    code += '\n';

    code += `url <- "${data.url}"\n\n`;

    if (Object.keys(data.headers).length > 0) {
        code += 'headers <- c(\n';
        const headerEntries = Object.entries(data.headers);
        headerEntries.forEach(([key, value], index) => {
            const comma = index < headerEntries.length - 1 ? ',' : '';
            code += `    "${key}" = "${value}"${comma}\n`;
        });
        code += ')\n\n';
    }

    if (data.body) {
        if (data.isBinary) {
            code += `body_base64 <- "${data.body}"\n`;
            code += 'body <- base64decode(body_base64)\n\n';
        } else {
            code += `body <- '${data.body.replace(/'/g, "\\'")}'\n\n`;
        }
    }

    code += `response <- ${data.method}(\n`;
    code += '    url = url';

    if (Object.keys(data.headers).length > 0) {
        code += ',\n    add_headers(.headers = headers)';
    }

    if (data.body) {
        code += ',\n    body = body';
    }

    code += '\n)\n\n';
    code += 'content(response, "text")';

    return code;
}

type GeneratorFn = (data: RequestData) => string;

const generators: Record<string, Record<string, GeneratorFn>> = {
    shell: {
        curl: toCurl,
        wget: toWget,
        httpie: toHttpie,
        powershell: toPowershell,
    },
    javascript: {
        fetch: toJavaScriptFetch,
        xhr: toJavaScriptXHR,
        axios: toAxios,
    },
    python: {
        requests: toPython,
    },
    java: {
        '': toJava,
    },
    go: {
        '': toGo,
    },
    php: {
        '': toPhp,
    },
    ruby: {
        '': toRuby,
    },
    csharp: {
        '': toCSharp,
    },
    kotlin: {
        '': toKotlin,
    },
    rust: {
        '': toRust,
    },
    dart: {
        '': toDart,
    },
    r: {
        '': toR,
    },
};

export async function POST(request: NextRequest) {
    try {
        const requestData: RequestData = await request.json();

        const { language, variant } = requestData;

        const langGenerators = generators[language];
        if (!langGenerators) {
            return NextResponse.json({ code: toCurl(requestData) });
        }

        const generator = langGenerators[variant] || langGenerators[''];
        if (!generator) {
            return NextResponse.json({ code: toCurl(requestData) });
        }

        const code = generator(requestData);
        return NextResponse.json({ code });
    } catch (error) {
        console.error('Code generation error:', error);
        return NextResponse.json(
            { error: `Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
