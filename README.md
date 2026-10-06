# Tea & Coffee Night: group sign-in

A small sign-in page for the Dialogue Student Association's Tea & Coffee Night at UT Austin. Guests scan a QR code, write their name, and are placed in a discussion group. The number of groups is chosen on the night, once you can see how many people came.

<img src="qr.png" alt="QR code for the sign-in page" width="220">

- **Guests:** https://ibrahima146.github.io/DCA-100-Person-Event/
- **Hosts:** https://ibrahima146.github.io/DCA-100-Person-Event/host.html

## On the night

1. **Put the QR code where people arrive.** Print `qr.png`, or open the host page and press **Print this sign**.
2. **Guests scan it and write their name.** Their phone says they're on the list. Nobody needs to count: the host page shows how many have signed in, live.
3. **When most people are in, pick the number of groups** on the host page. It shows the sizes you'd get, for example "8 groups of 9–10".
4. **Press "Show groups on phones".** Every phone shows its group. No second scan.

Anyone who signs in after that gets a group straight away. Groups are random, and never differ in size by more than one person.

On the host page you can also change the number of groups (this moves people around), hide the groups again, or start over with an empty list.

**Before the event,** press **Start over with an empty list** on the host page so test sign-ins don't count.

## Good to know

- **Names stay on each phone.** Nothing is collected, so you get a headcount, not an attendee list.
- **One phone can sign in several people** with "Signing in a friend too?".
- **Guests should keep the page open.** If a phone locks, the group appears as soon as it's unlocked.
- **The count lives on a free service** ([abacus.jasoncameron.dev](https://abacus.jasoncameron.dev)). It limits how fast one wifi network can talk to it, so in a rush at the door a sign-in can take 10–20 seconds. If it can't be reached at all, guests still get a random group but aren't counted.
- **The host page has no password.** Don't share its link with guests.

## Settings

Everything adjustable is in [`config.js`](config.js):

| Setting | What it does |
| --- | --- |
| `groups` | Where the group picker starts on the host page |
| `groupLabel` | The word above the number: "Group", "Table", "Circle"... |
| `counterNamespace` | Name of the shared sign-in list. Change it for a brand new list |
| `hostToken` | Lets the host page announce groups and start over |

Edit the file on GitHub and the site updates in about a minute.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page guests see |
| `host.html` | The host page: live count, group picker, printable sign |
| `app.js` | Shared logic: the counter service, live updates, dealing people into groups |
| `style.css` | The cream paper look |
| `qr.png`, `qr.svg` | QR code for the guest page |

The site is plain HTML, CSS and JavaScript with no build step, served by GitHub Pages from the `main` branch.

If the repository is renamed or moved, the address changes and `qr.png` / `qr.svg` need regenerating. The QR code on the host page always matches wherever the site is running.
