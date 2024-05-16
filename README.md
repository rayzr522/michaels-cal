# michaels-cal

> a simple script to login to Michaels' employee portal & convert your schedule to an ICS file

## setup

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
