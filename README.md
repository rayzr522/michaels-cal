# michaels-cal

> a simple script to login to Michaels employee portal & convert your schedule to an ICS file

## setup

requirements:

- [`node`](https://nodejs.org/en/download/) (or install via `pnpm env use -g lts`, which i personally find easier to manage)
- [`pnpm`](https://pnpm.io/installation)

first you will need to set up your `.env` file. the variables are as follows:

| name               | desc                                                                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MICHAELS_USER`    | your Michaels employee portal username                                                                                                                                                                |
| `MICHAELS_PASS`    | your Michaels employee portal password                                                                                                                                                                |
| `MICHAELS_ADDRESS` | optional the address of your Michaels store, e.x. `Michaels, 45045 Worth Ave, California, MD 20619, USA`. will be added to cal events                                                                 |
| `TZ`               | useful to ensure proper date parsing if you're running this on a VPS in a different timezone than your Michaels local timezone. see [Node docs](https://nodejs.org/api/cli.html#tz) for valid values. |

```bash
# clone the repo
git clone https://github.com/rayzr522/michaels-cal.git
cd michaels-cal
# install deps
pnpm install
# run the script
pnpm start
```

## automating

you can automate this by running the script via cron and hosting the file with a webserver like nginx. i wont give exact steps, but here's a rough idea of what that could look like.

first, setup the repo on a VPS:

```bash
# install git, pnpm, node
git clone https://github.com/rayzr522/michaels-cal.git
# set it up
cd michaels-cal
pnpm install
nano .env # configure your .env vars here
```

now, create `/usr/local/bin/update-michaels-cal.sh`:

```bash
#!/bin/bash
set -ex
# replace this with the path to your repo
cd /home/ubuntu/michaels-cal
# -i to run the .bashrc, which is needed for the pnpm command
sudo -u ubuntu bash -i -c "pnpm start"
# replace this with the path to your webserver's data directory
cp -f ./out/michaels-cal.ics /var/www/html/site/
```

dont forget to `sudo chmod +x /usr/local/bin/update-michaels-cal.sh` so its executable

you can have this run on a regular schedule, like every day at 8pm with a cron job (`sudo crontab -e`):

```cron
0 20 * * * /usr/local/bin/update-michaels-cal.sh
```

([crontab.guru](https://crontab.guru) is useful for figuring out the sequence you want)

now as long as you have a webserver running on your VPS hosting the directory that the script writes to, you can subscribe to the calendar file in your calendar app of choice via `http://<your-vps-ip>/michaels-cal.ics`
