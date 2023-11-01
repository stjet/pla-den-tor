The most legalest private file (specifically manga and anime) hosting ever, on TOR. Includes a manga viewer. Nothing fancy. Uses HTTP Basic Authentication with daily rotating password derived from a master password.

Most of the code is a modification of [hedgeblog](https://github.com/jetstream0/hedgeblog), albeit with some pretty significant modifications in places (templates, host.ts, build.ts, saki.ts).

Since TOR is pretty slow to download large files (eg, videos), the videos are streamed so load time isn't as bad as one might expect (HTTP protocol is amazing, browsers are amazing!).

# Running
After first cloning or downloading the repository:

```bash
npm install
npm install typescript -g
npm run compile
npm run build
# and you may have to do:
mkdir tor
mkdir tor/hidden_service
```

Don't forget to make a `.env` file with the `master_password` variable, from which all the daily passwords are dervied.

Then to actually run:

```bash
bash tor_prebuilt.sh
```

If you are running multiple TOR hidden services, you will need to modify the [.torrc file](https://stackoverflow.com/questions/14321214/how-to-run-multiple-tor-processes-at-once-with-different-exit-ips#18895491).
