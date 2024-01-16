The most legalest private file (specifically for manga, anime, music) hosting ever, on TOR. Includes a manga viewer. Nothing fancy. Uses HTTP Basic Authentication with daily rotating password derived from a master password.

Most of the code is a modification of [hedgeblog](https://github.com/jetstream0/hedgeblog), albeit with some pretty significant modifications in places (templates, host.ts, build.ts).

Since TOR is pretty slow to download large files (eg, videos), the videos are streamed so load time isn't as bad as one might expect (HTTP protocol is amazing, browsers are amazing).

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

Make sure to set a master password! See `.env.example`. Enter in the master password at /password to get the current day and the next day's password.

# Tips

## Adding media
Add it to the relevant static directory (`/static_assets/anime_assets`, `/static_assets/manga_assets`, or `/static_assets/music_assets`), and create an entry for it in `host_info.json`. See `host_info.json.example` for an example.

## Hosting Multiple TOR Hidden Services
If you are running multiple TOR hidden services, you will need to modify the [.torrc file](https://stackoverflow.com/questions/14321214/how-to-run-multiple-tor-processes-at-once-with-different-exit-ips#18895491).

## Master Password
To set the master password, create a `.env` file like so:

```
master_password=example_password_do_not_actually_use_this_as_your_password_obviously
```

## Username
The username doesn't matter. Only the password is important.

# Disclaimer
blah blah blah meant for private use, I would never dream of breaking copyright law blah blah blah not the intended purpose.
