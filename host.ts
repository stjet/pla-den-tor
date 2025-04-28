import { createServer } from 'http';
import { createServer as createServerHttps } from 'https';
import * as path from 'path';
import { existsSync, readFileSync, statSync, createReadStream } from 'fs';
import { createHash } from 'crypto';
import { config }  from 'dotenv';

config();

function get_password(date: Date = new Date()): string {
  //password changes every day
  const hash = createHash("sha256");
  hash.update(`${process.env.master_password}${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`, "utf-8");
  return hash.digest("hex");
}

const port: number = process.argv.map((arg) => Number(arg)).filter((arg) => !isNaN(arg))[0] ?? 8043;
const stream_chunk_size: number = 2 * 1024 * 1024; //2 MiB

//meant for running locally, where password is not needed and a hassle
const pass = !process.argv.includes("--no-password");

const request_handler = (req, res) => {
  const todays_password: string = get_password();
  let req_path: string;
  if (req.url.includes("..")) {
    //nice try
    //bad request
    res.writeHead(400);
    //write file
    res.write("400");
    //end response
    return res.end();
  }
  const url_obj = new URL(req.url, `http://${req.headers.host}`);
  if (!req.url.includes(".")) {
    req_path = path.join(__dirname, "build", decodeURI(req.url), "index.html");
  } else {
    //is file
    if (url_obj.pathname.startsWith("/anime_assets") || url_obj.pathname.startsWith("/manga_assets") || url_obj.pathname.startsWith("/music_assets") || url_obj.pathname.startsWith("/music_subtitle_assets") || url_obj.pathname.startsWith("/playlists")) {
      req_path = path.join(__dirname, "static_assets", decodeURI(req.url));
    } else {
      req_path = path.join(__dirname, "build", decodeURI(req.url));
    }
  }
  /*
  if (!req_path.startsWith(path.join(__dirname, "build"))) {
    //nice try
    //bad request
    res.writeHead(400);
    //write file
    res.write("400");
    //end response
    return res.end();
  }
  */
  //check for auth
  //hopefully no security vulnerabilities. please look away
  if (url_obj.pathname !== "/password" && pass) {
    const auth_header: string | undefined = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
    if (typeof auth_header === "undefined") {
      //unauthorized
      res.writeHead(401, {
        "WWW-Authenticate": "Basic realm=\"Access to the site\"",
      });
      return res.end();
    }
    //get rid of the "Basic "
    const base64_pair: string = auth_header.slice(6);
    //we don't care about username
    const provided_password: string = Buffer.from(base64_pair, "base64").toString("ascii").split(":")[1]; //we know there will not be a ":" in the password since it is a hash
    if (todays_password !== provided_password && pass) {
      //unauthorized
      res.writeHead(401, {
        "WWW-Authenticate": "Basic realm=\"Access to the site\"",
      });
      return res.end();
    }
  }
  //do 404 after password, otherwise people will know paths that exist on the server
  if (!existsSync(req_path)) {
    res.writeHead(404);
    //write file
    res.write("404");
    return res.end();
  }
  const file_ext: string = req_path.split(".")[1];
  //set content type
  let non_utf8_content_types: string[] = ["image/png", "image/gif", "image/jpeg", "audio/mpeg", "video/mp4"];
  let content_type: string;
  switch (file_ext) {
    case "html":
      content_type = "text/html; charset=utf-8";
      break;
    case "css":
      content_type = "text/css; charset=utf-8";
      break;
    case "js":
      content_type = "text/javascript";
      break;
    case "xml":
      content_type = "text/xml";
      break;
    case "vtt":
      content_type = "text/vtt";
      break;
    case "png":
    case "ico":
      content_type = "image/png";
      break;
    case "gif":
      content_type = "image/gif";
      break;
    case "jpeg":
    case "jpg":
      content_type = "image/jpeg";
      break;
    case "mp3":
      content_type = "audio/mpeg";
      break;
    case "mp4":
      content_type = "video/mp4";
      break;
    default:
      content_type = "text/plain";
  }
  if (content_type === "video/mp4" && req.headers.range?.startsWith("bytes")) {
    const size: number = statSync(req_path).size;
    const range: string[] = req.headers.range.slice(6).split("-"); //remove the "bytes="
    //we want to enforce our streaming chunky thing so therefore we are ignoring their range end
    //if start range missing / NaN or decimal, reject
    const start: number = Number(range[0]);
    if (isNaN(Number(range[0])) || Math.floor(Number(range[0])) !== Number(range[0])) {
      //bad request
      res.writeHead(400);
      //write file
      res.write("400");
      //end response
      return res.end();
    }
    //obviously end cannot be after the end of the file
    //has to be >= since start is ero based, but size is not
    const end: number = start + stream_chunk_size >= size ? size - 1 : start + stream_chunk_size;
    const content_length: number = end - start + 1;
    res.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Content-Length": content_length,
      "Content-Type": content_type,
      "Content-Range": `bytes ${start}-${end}/${size}`,
    });
    const stream = createReadStream(req_path, {
      start,
      end,
    });
    stream.pipe(res); //this will do res.end() for us, I think?
    return;
  }
  res.writeHead(200, {
    "Content-Type": content_type,
  });
  //write file
  if (non_utf8_content_types.includes(content_type)) {
    res.write(readFileSync(req_path));
  } else {
    res.write(readFileSync(req_path, "utf-8"));
  }
  //end response
  return res.end();
};

if (process.argv.includes("--https")) {
  createServerHttps({
    key: readFileSync("server.key"),
    cert: readFileSync("server.cert"),
  }, request_handler).listen(port + 1);
  console.log(`Hosting HTTPS on port ${port + 1}`);
}

createServer(request_handler).listen(port);
console.log(`Hosting on port ${port}`);
