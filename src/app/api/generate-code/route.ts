import { NextRequest, NextResponse } from 'next/server';

interface RequestData {
    curlCommand: string;
    language: string;
    variant: string;
}

// Parse curl command into structured data
function parseCurlCommand(curlCmd: string): {
    method: string;
    url: string;
    headers: Record<string, string>;
    data: string | null;
} {
    const result = {
        method: 'GET',
        url: '',
        headers: {} as Record<string, string>,
        data: null as string | null,
    };

    // Extract method
    const methodMatch = curlCmd.match(/-X\s+(\w+)/);
    if (methodMatch) {
        result.method = methodMatch[1];
    }

    // Extract URL (first quoted string after curl command)
    const urlMatch = curlCmd.match(/curl\s+-X\s+\w+\s+'([^']+)'/);
    if (urlMatch) {
        result.url = urlMatch[1];
    }

    // Extract headers
    const headerMatches = curlCmd.matchAll(/-H\s+'([^:]+):\s*([^']+)'/g);
    for (const match of headerMatches) {
        result.headers[match[1]] = match[2];
    }

    // Extract data
    const dataMatch = curlCmd.match(/-d\s+'([\s\S]+)'$/);
    if (dataMatch) {
        // Unescape single quotes
        result.data = dataMatch[1].replace(/'\\''/g, "'");
    }

    return result;
}

// Generate Python requests code
function toPython(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = 'import requests\n\n';

    if (Object.keys(parsed.headers).length > 0) {
        code += 'headers = {\n';
        for (const [key, value] of Object.entries(parsed.headers)) {
            code += `    '${key}': '${value}',\n`;
        }
        code += '}\n\n';
    }

    if (parsed.data) {
        code += `data = '${parsed.data.replace(/'/g, "\\'")}'\n\n`;
    }

    code += `response = requests.${parsed.method.toLowerCase()}(\n`;
    code += `    '${parsed.url}',\n`;

    if (Object.keys(parsed.headers).length > 0) {
        code += '    headers=headers,\n';
    }

    if (parsed.data) {
        code += '    data=data,\n';
    }

    code += ')\n';
    code += 'print(response.text)';

    return code;
}

// Generate JavaScript fetch code
function toJavaScriptFetch(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = `fetch('${parsed.url}', {\n`;
    code += `    method: '${parsed.method}',\n`;

    if (Object.keys(parsed.headers).length > 0) {
        code += '    headers: {\n';
        for (const [key, value] of Object.entries(parsed.headers)) {
            code += `        '${key}': '${value}',\n`;
        }
        code += '    },\n';
    }

    if (parsed.data) {
        code += `    body: ${JSON.stringify(parsed.data)},\n`;
    }

    code += '})\n';
    code += '    .then(response => response.text())\n';
    code += '    .then(data => console.log(data))\n';
    code += '    .catch(error => console.error(error));';

    return code;
}

// Generate JavaScript XHR code
function toJavaScriptXHR(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = 'const xhr = new XMLHttpRequest();\n';
    code += `xhr.open('${parsed.method}', '${parsed.url}');\n\n`;

    for (const [key, value] of Object.entries(parsed.headers)) {
        code += `xhr.setRequestHeader('${key}', '${value}');\n`;
    }

    code += '\nxhr.onload = function() {\n';
    code += '    console.log(xhr.responseText);\n';
    code += '};\n\n';

    if (parsed.data) {
        code += `xhr.send(${JSON.stringify(parsed.data)});`;
    } else {
        code += 'xhr.send();';
    }

    return code;
}

// Generate Axios code
function toAxios(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = "const axios = require('axios');\n\n";

    code += 'axios({\n';
    code += `    method: '${parsed.method.toLowerCase()}',\n`;
    code += `    url: '${parsed.url}',\n`;

    if (Object.keys(parsed.headers).length > 0) {
        code += '    headers: {\n';
        for (const [key, value] of Object.entries(parsed.headers)) {
            code += `        '${key}': '${value}',\n`;
        }
        code += '    },\n';
    }

    if (parsed.data) {
        code += `    data: ${JSON.stringify(parsed.data)},\n`;
    }

    code += '})\n';
    code += '    .then(response => console.log(response.data))\n';
    code += '    .catch(error => console.error(error));';

    return code;
}

// Generate Go code
function toGo(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = 'package main\n\n';
    code += 'import (\n';
    code += '    "fmt"\n';
    code += '    "io"\n';
    code += '    "net/http"\n';
    if (parsed.data) {
        code += '    "strings"\n';
    }
    code += ')\n\n';

    code += 'func main() {\n';

    if (parsed.data) {
        code += `    body := strings.NewReader(\`${parsed.data}\`)\n`;
        code += `    req, _ := http.NewRequest("${parsed.method}", "${parsed.url}", body)\n`;
    } else {
        code += `    req, _ := http.NewRequest("${parsed.method}", "${parsed.url}", nil)\n`;
    }

    for (const [key, value] of Object.entries(parsed.headers)) {
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
function toPhp(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = '<?php\n\n';
    code += '$ch = curl_init();\n\n';
    code += `curl_setopt($ch, CURLOPT_URL, '${parsed.url}');\n`;
    code += 'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n';
    code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${parsed.method}');\n\n`;

    if (Object.keys(parsed.headers).length > 0) {
        code += 'curl_setopt($ch, CURLOPT_HTTPHEADER, [\n';
        for (const [key, value] of Object.entries(parsed.headers)) {
            code += `    '${key}: ${value}',\n`;
        }
        code += ']);\n\n';
    }

    if (parsed.data) {
        code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${parsed.data.replace(/'/g, "\\'")}');\n\n`;
    }

    code += '$response = curl_exec($ch);\n';
    code += 'curl_close($ch);\n\n';
    code += 'echo $response;';

    return code;
}

// Generate Ruby code
function toRuby(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = "require 'net/http'\n";
    code += "require 'uri'\n\n";

    code += `uri = URI.parse('${parsed.url}')\n`;
    code += 'http = Net::HTTP.new(uri.host, uri.port)\n';
    code += 'http.use_ssl = true if uri.scheme == "https"\n\n';

    code += `request = Net::HTTP::${parsed.method.charAt(0) + parsed.method.slice(1).toLowerCase()}.new(uri.request_uri)\n`;

    for (const [key, value] of Object.entries(parsed.headers)) {
        code += `request['${key}'] = '${value}'\n`;
    }

    if (parsed.data) {
        code += `request.body = '${parsed.data.replace(/'/g, "\\'")}'\n`;
    }

    code += '\nresponse = http.request(request)\n';
    code += 'puts response.body';

    return code;
}

// Generate Java code
function toJava(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = 'import java.net.http.HttpClient;\n';
    code += 'import java.net.http.HttpRequest;\n';
    code += 'import java.net.http.HttpResponse;\n';
    code += 'import java.net.URI;\n\n';

    code += 'public class Main {\n';
    code += '    public static void main(String[] args) throws Exception {\n';
    code += '        HttpClient client = HttpClient.newHttpClient();\n\n';

    code += '        HttpRequest request = HttpRequest.newBuilder()\n';
    code += `            .uri(URI.create("${parsed.url}"))\n`;
    code += `            .method("${parsed.method}", `;

    if (parsed.data) {
        code += `HttpRequest.BodyPublishers.ofString("${parsed.data.replace(/"/g, '\\"')}"))\n`;
    } else {
        code += 'HttpRequest.BodyPublishers.noBody())\n';
    }

    for (const [key, value] of Object.entries(parsed.headers)) {
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
function toCSharp(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = 'using System;\n';
    code += 'using System.Net.Http;\n';
    code += 'using System.Threading.Tasks;\n\n';

    code += 'class Program\n{\n';
    code += '    static async Task Main()\n    {\n';
    code += '        using var client = new HttpClient();\n\n';

    code += `        var request = new HttpRequestMessage(HttpMethod.${parsed.method.charAt(0) + parsed.method.slice(1).toLowerCase()}, "${parsed.url}");\n`;

    for (const [key, value] of Object.entries(parsed.headers)) {
        code += `        request.Headers.Add("${key}", "${value}");\n`;
    }

    if (parsed.data) {
        code += `        request.Content = new StringContent("${parsed.data.replace(/"/g, '\\"')}");\n`;
    }

    code += '\n        var response = await client.SendAsync(request);\n';
    code += '        Console.WriteLine(await response.Content.ReadAsStringAsync());\n';
    code += '    }\n}';

    return code;
}

// Generate Kotlin code
function toKotlin(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = 'import java.net.http.HttpClient\n';
    code += 'import java.net.http.HttpRequest\n';
    code += 'import java.net.http.HttpResponse\n';
    code += 'import java.net.URI\n\n';

    code += 'fun main() {\n';
    code += '    val client = HttpClient.newHttpClient()\n\n';

    code += '    val request = HttpRequest.newBuilder()\n';
    code += `        .uri(URI.create("${parsed.url}"))\n`;
    code += `        .method("${parsed.method}", `;

    if (parsed.data) {
        code += `HttpRequest.BodyPublishers.ofString("${parsed.data.replace(/"/g, '\\"')}"))\n`;
    } else {
        code += 'HttpRequest.BodyPublishers.noBody())\n';
    }

    for (const [key, value] of Object.entries(parsed.headers)) {
        code += `        .header("${key}", "${value}")\n`;
    }

    code += '        .build()\n\n';
    code += '    val response = client.send(request, HttpResponse.BodyHandlers.ofString())\n';
    code += '    println(response.body())\n';
    code += '}';

    return code;
}

// Generate Rust code
function toRust(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = 'use reqwest;\n\n';
    code += '#[tokio::main]\n';
    code += 'async fn main() -> Result<(), Box<dyn std::error::Error>> {\n';
    code += '    let client = reqwest::Client::new();\n\n';

    code += `    let response = client.${parsed.method.toLowerCase()}("${parsed.url}")\n`;

    for (const [key, value] of Object.entries(parsed.headers)) {
        code += `        .header("${key}", "${value}")\n`;
    }

    if (parsed.data) {
        code += `        .body("${parsed.data.replace(/"/g, '\\"')}")\n`;
    }

    code += '        .send()\n';
    code += '        .await?;\n\n';
    code += '    println!("{}", response.text().await?);\n';
    code += '    Ok(())\n';
    code += '}';

    return code;
}

// Generate Dart code
function toDart(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = "import 'package:http/http.dart' as http;\n\n";
    code += 'void main() async {\n';

    code += `    final response = await http.${parsed.method.toLowerCase()}(\n`;
    code += `        Uri.parse('${parsed.url}'),\n`;

    if (Object.keys(parsed.headers).length > 0) {
        code += '        headers: {\n';
        for (const [key, value] of Object.entries(parsed.headers)) {
            code += `            '${key}': '${value}',\n`;
        }
        code += '        },\n';
    }

    if (parsed.data) {
        code += `        body: '${parsed.data.replace(/'/g, "\\'")}',\n`;
    }

    code += '    );\n\n';
    code += '    print(response.body);\n';
    code += '}';

    return code;
}

// Generate wget code
function toWget(parsed: ReturnType<typeof parseCurlCommand>): string {
    let cmd = `wget --method=${parsed.method}`;

    for (const [key, value] of Object.entries(parsed.headers)) {
        cmd += ` \\\n  --header='${key}: ${value}'`;
    }

    if (parsed.data) {
        cmd += ` \\\n  --body-data='${parsed.data}'`;
    }

    cmd += ` \\\n  '${parsed.url}'`;

    return cmd;
}

// Generate HTTPie code
function toHttpie(parsed: ReturnType<typeof parseCurlCommand>): string {
    let cmd = `http ${parsed.method} '${parsed.url}'`;

    for (const [key, value] of Object.entries(parsed.headers)) {
        cmd += ` \\\n  '${key}:${value}'`;
    }

    if (parsed.data) {
        // For JSON data, try to parse and use HTTPie's syntax
        try {
            const jsonData = JSON.parse(parsed.data);
            for (const [key, value] of Object.entries(jsonData)) {
                cmd += ` \\\n  ${key}='${value}'`;
            }
        } catch {
            // Not JSON, use raw body
            cmd += ` \\\n  --raw='${parsed.data}'`;
        }
    }

    return cmd;
}

// Generate PowerShell code
function toPowershell(parsed: ReturnType<typeof parseCurlCommand>): string {
    let code = '';

    if (Object.keys(parsed.headers).length > 0) {
        code += '$headers = @{\n';
        for (const [key, value] of Object.entries(parsed.headers)) {
            code += `    '${key}' = '${value}'\n`;
        }
        code += '}\n\n';
    }

    if (parsed.data) {
        code += `$body = '${parsed.data.replace(/'/g, "''")}'\n\n`;
    }

    code += 'Invoke-RestMethod `\n';
    code += `    -Uri '${parsed.url}' \`\n`;
    code += `    -Method ${parsed.method}`;

    if (Object.keys(parsed.headers).length > 0) {
        code += ' `\n    -Headers $headers';
    }

    if (parsed.data) {
        code += ' `\n    -Body $body';
    }

    return code;
}

const generators: Record<string, Record<string, (parsed: ReturnType<typeof parseCurlCommand>) => string>> = {
    shell: {
        curl: () => '', // Special case - return original command
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
};

export async function POST(request: NextRequest) {
    try {
        const { curlCommand, language, variant }: RequestData = await request.json();

        if (!curlCommand) {
            return NextResponse.json({ error: 'curlCommand is required' }, { status: 400 });
        }

        // If language is shell/curl, just return the command
        if (language === 'shell' && variant === 'curl') {
            return NextResponse.json({ code: curlCommand });
        }

        const parsed = parseCurlCommand(curlCommand);

        const langGenerators = generators[language];
        if (!langGenerators) {
            return NextResponse.json({ code: curlCommand });
        }

        const generator = langGenerators[variant] || langGenerators[''];
        if (!generator) {
            return NextResponse.json({ code: curlCommand });
        }

        const code = generator(parsed);
        return NextResponse.json({ code });
    } catch (error) {
        console.error('Code generation error:', error);
        return NextResponse.json(
            { error: `Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
