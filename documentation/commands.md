# Command Reference

Although the tutorial gives a large amount of information, if you find
remembering the commands too complicated, here's a reference. Remember
that you can type out multiple commands in one go; for example:
`BAW231 fh 090 d 30 sp 180` will work as well as all three commands run
separately. Some commands have "aliases" that are shorter to type. An
example of that would be the `takeoff` command which has an alias `to`.

##### Table of Contents

[Departure commands](#Departure commands)
- [Cleared as Filed](#Cleared As Filed)
- [Climb via SID](#Climb Via SID)
- [SID](#SID)
- [Takeoff](#Takeoff)
- [Taxi](#Taxi)

[Arrival commands](#Arrival commands)
- [Descend via STAR](#Descend via STAR)
- [Land](#Land)
- [STAR](#STAR)

[Routing commands](#Routing commands)
- [~~Fix~~](#~~Fix~~)
- [Hold](#Hold)
- [Proceed Direct](#Proceed Direct)
- [Route](#Route)
- [Reroute](#Reroute)
- [Say Route](#Say Route)
[Aircraft Control commands](#Aircraft Control commands)
- [Abort](#Abort)
- [Altitude](#Altitude)
- [Heading](#Heading)
- [Speed](#Speed)
- [Squawk](#Squawk)

[System commands](#System commands)
- [Move Data Block](#Move Data Block)
- [Pause](#Pause)
- [Timewarp](#Timewarp)
- [Tutorial](#Tutorial)
- [Version](#Version)

## Departure commands
These commands are only used by aircraft that are departing from the selected airport.

### Cleared As Filed
_Aliases -_ `caf`

_Information -_ This command tells the airplane that they are cleared to follow
the flight plan that they requested when spawning. Therefore, when a departure
spawns on the ground, and his strip shows that he filed for a particular SID,
there is no need to use the `sid` command. Just clear him "as filed" with the
`caf` command, and the airplane will take care of the rest.

_Syntax -_ `AAL123 caf`

### Climb Via SID
_Aliases -_ `cvs`

_Information -_ Authorizes the aircraft to climb in accordance with the
SID that is currently in their flightplan. They will climb to their filed
cruise altitude, whilst complying with all altitude and speed restrictions
posted in the procedure.

_Syntax -_ `AAL123 cvs`

### SID
_Aliases -_ `sid`

_Information -_ This command tells the specified plane a standard
instrument departure route (SID) it should follow. Each SID is a list of
fixes to be flown in sequence. Having a standardized route often helps
organize departing traffic, and maintain separation from arriving aircraft.

_Syntax -_ `AAL123 sid [SID name]`

### Takeoff
_Aliases -_ `takeoff`, `to`, `cto`

_Hotkey -_ `numpad /`

_Information -_ This command clears the specified plane for takeoff. They
will climb to the altitude specified, or in accordance with a SID if told
previously to "climb via the SID". If neither has happened, they will ask
for an altitude assignment before they agree to take off.

_Syntax -_ `AAL123 cto`

### Taxi
_Aliases -_ `taxi` / `wait` / `w`

_Information -_ This command tells the specified plane to taxi to a
runway; if a runway is not included they will continue to the runway
with the largest headwind.

_Syntax -_ `AAL123 taxi [Runway]`

## Arrival commands
These commands are only used by aircraft arriving at a selected airport.

### Descend via STAR
_Aliases -_ `dvs`

_Information -_ Authorizes the aircraft to descend in accordance with the
SID that is currently in their flightplan. They will descend to the lowest
altitude required by the STAR, and after no further altitude and/or speed
restrictions are listed, will maintain their altitude and speed until
receiving further instructions from ATC.

_Syntax -_ `AAL123 dvs`

### Land
_Aliases -_ `ils` / `i` / `land` / `l`

_Shortkey -_ `numpad *`

_Information -_ This command clears the aircraft to land on a runway. The
aircraft's strip on the right will show either "intercept" if it's still
trying to intercept the localizer. Once established, it will show "on ILS"
and the aircraft will automatically fly down the runway centerline, descend,
and land.

_Syntax -_ `AAL123 i [rwy]`

### STAR
_Aliases -_ `star`

_Information -_ This command tells the plane to add or change their filed
Standard Terminal Arrival Route to match the route you specify. This must be
entered in dotted format, and include the point where the STAR is joined, as
well as the destination airport, for example: `MLP.GLASR9.KSEA`. See the section
on rerouting for further detail.

_Syntax -_ `AAL123 star [transition].[STAR name].[airport]`

## Routing commands
Instructions on the syntax for editing the aircraft's route are described in the `route` and `reroute` commands.

### ~~Fix~~
~~_Aliases -_ `f` / `fix` / `track`~~

~~_Syntax -_ `AAL123 f [fixname]`~~
*_This command has been deprecated_*

### Hold
_Aliases -_ `hold`

_Information -_ This command instructs the aircraft to enter a holding
pattern until further notice. The direction (left/right) may be specified,
as well as the leg length (in minutes), as well as the fix to hold over.
But you may also omit those specifications, in which case, the aircraft
will enter a standard holding pattern over their present position (right
turns, 1 minute legs). To escape a hold, just set a new heading.

_Parameters -_ Specify the direction of turns during the hold with `right`
or `left`, the leg length, with `[time]min`, and the fix to hold over
with simply `[fixname]`. Any combination of these arguments provided in
any order is acceptable, as long as the command `hold` comes first.

_Syntax -_ `AAL123 hold [fixname] [left|right] [leg_time]min` or `AAL123 hold`

### Proceed Direct
_Aliases -_ `direct` / `pd` / `dct`

_Information -_ This command instructs the aircraft to go direct to a
navigational fix, taking a shortcut. For example, if an aircraft is flying
to fixes [A, B, C], issuing the command "pd B" will cause the aircraft
to go to B, then C. After flying past the last fix, the aircraft will
continue flying straight.

_Syntax -_ `AAL123 pd [fixname]`

### Route
_Aliases -_ `route`

_Information -_ This command instructs aircraft to follow a user-provided "route", typically
one that is along an airway, approach, SID, STAR, other published procedure,
or a series of fixes. This is similar to the `reroute`/`rr` command, but this
command will allow you to "insert" a route that connects with the route
they're currently flying. Note that the route uses dot format:

>Note: Input data needs to be provided with single dots connecting all
procedurally-linked points (eg KSFO.OFFSH9.SXC or SGD.V87.MOVER), and all
other points that will be simply a fix direct to another fix need to be
connected with double-dots (eg HLI..SQS..BERRA..JAN..KJAN).

An example would be if an aircraft filed to take a particular airway, and
you needed them to take a different one. Additionally, if the current route
*and* the user-provided route share a common point, the routes are considered
to have "continuity", and the FMS will remove the intermediate fixes. This
is demonstrated below:  
Current Route: `BAM..CUTVA..LLC..FMG..BINNZ..HETUX..CHOIR..NEWPI..LKV.HAWKZ4.KSEA`  
Command run: `AAL123 route FESKO..RUFUS..CHOIR`  
Resulting route: `FESKO..RUFUS..CHOIR..NEWPI..LKV.HAWKZ4.KSEA`

Thus, since the routes have continuity at CHOIR, we are able to give shortcuts and/or
route extensions without needing to restate the whole route, as with the `rr` command.
In the case of the above example, the aircraft would immediately turn direct to `FESKO`,
join the specified route to `CHOIR`, and continue via last routing cleared.

Partial Route Example: `WHITE.J209.ORF` or `FESKO..RUFUS..CHOIR` or `KSEA.MTN7.ELN..HAMUR.J12.DNJ`

_Syntax -_ `AAL123 route [route]`

### Reroute
_Aliases -_ `reroute`, `rr`

_Information -_ This command allows you to wipe out the aircraft's current
route, and assign a new route of your choosing. This is similar to the `route`
command, but this command will allow you to *change the entire route*, while the
other is meant for specifying a route to follow to join a later point in the
aircraft's flight plan. Note that the route uses dot format:

>Note: Input data needs to be provided with single dots connecting all procedurally-
linked points (eg KSFO.OFFSH9.SXC or SGD.V87.MOVER), and all other points that will
be simply a fix direct to another fix need to be connected with double-dots
(eg HLI..SQS..BERRA..JAN..KJAN).

Full Route Example: `KSEA.HAROB5.ERAVE.Q1.ETCHY..MLBEC.BDEGA2.KSFO`

_Syntax -_ `AAL123 rr [route]`

### Say Route
_Aliases -_ `sr`

_Information -_ With the capability to edit the route, you obviously will
need a way to know what their current route is. Typically, this is displayed
in the flight progress strip. However, to preserve screen space, you will
instead have to check the route by running this command, and the route will
print out above the command bar.

_Syntax -_ `AAL123 sr`

## Aircraft Control commands
These commands modify the aircraft but are not limited to departures or arrivals.

### Abort
_Aliases -_ `abort`

_Information -_ Instructs the aircraft to abort the current operation.
Currently, only landings, taxiing, and fix navigation can be aborted.

_Syntax -_ `AAL123 abort`

### Altitude
_Aliases -_ `climb` / `c` / `descend` / `d` / `altitude` / `a`

_Hotkey -_ `up arrow` / `down arrow` (if "Control Method" setting = "Arrow Keys")

_Information -_ This command tells the specified plane the altitude, in
hundreds of feet (flight levels), it should travel to. This means that when
writing altitudes you would drop the last two zeros. For example, 3,000ft =
"30", 8,300ft = "83", 10,000ft = "100", and FL180 (18,000ft) = "180".
Airplanes will not descend below 1000 feet (unless locked on ILS).

Altitude also accepts an `expedite` or `x` argument which can be used as the last item in the command.

_Syntax -_ `AAL123 c [alt]` or `AAL123 c [alt] x`

### Heading
_Aliases -_ `heading` / `h` / `turn` / `t` / `fh`

_Shortkeys -_ `left arrow` / `right arrow` (if "Control Method" setting = "Arrow Keys")

_Information -_ This command sets the target heading; up (north) is 360,
right (east) is 090, down (south) is 180, and left (west) is 270. Of course
you can use any angle in between these as well. If the heading is set
before takeoff, the aircraft will turn to that heading after takeoff. You
can force the aircraft to reach the heading by turning left or right by
inserting `l` or `r` before the new heading, as demonstrated below.

_Syntax -_ `AAL123 fh [hdg]` or `AAL123 (rightarrow) [hdg]` or `AAL123 t r [hdg]`

### Speed
_Aliases -_ `speed` / `slow` / `sp`

_ShortKey -_ `numpad +` / `numpad -`

_Information -_ This command sets the target speed; aircraft will stay within
their safe speeds if you tell them to fly faster or slower than they are able
to. It takes some time to increase and reduce speed. Remember that speed is
always expressed in knots.

_Syntax -_ `AAL123 - [spd]` or `AAL123 + [spd]`

### Squawk
_Aliases -_ `sq`

_Information -_ This command tells an aircraft to set its transponder code, or "squawk" a four-digit number, from `0000` to `7777`. These codes uniquely identify each plane to the air traffic controller. Certain codes have special significance, such as `0033: Paradrop in progress` or `1200: VFR`. Currently the squawk is purely cosmetic; including it in game mechanics is planned.

_Parameters -_ A four digit number. Each number must be between `0` and `7`, inclusive. For example, `0736` is a valid squawk, `9416` is not.

_Syntax -_ `AAL123 squawk ####`

## System Commands

openScope has a number of commands that do not change game mechanics, known as _system commands_. While most are able to be executed via various menus, they can be entered in the command bar if one so desires.

### Airport

_Information -_ Changes the current airport to the one specified.

_Parameters -_ The ICAO (four-letter) code of the desired airport.

_Syntax -_ `airport [ICAO]`

### Move Data Block
_Aliases -_ `` ` (backtick) ``

_Information -_ If aircraft data blocks are overlapping, it can be tough to
tell which aircraft is which. And on real ATC systems, moving the data block
is sometimes used by controllers to indicate the status of the aircraft, in
reference to whether or not they have been told to do something yet (for
instance, approach might move all the blocks down for a/c that have been
switched to tower frequency). In this sim, you can shift it in any of the 8
subcardinal directions, in reference to their relative position on the numpad:
`(8:N, 9:NE, 6:E, 3:SE, 2:S, 1:SW, 4:W, 7:NW)`. Additionally, position `5` can
be used to "shortstem" the aircraft, which puts the data block right on top of
the aircraft's position symbol.

_Syntax -_ ``AAL123 `2``

### Pause

_Information -_ Pauses the game. Click anywhere to resume.

_Syntax -_ `pause`

### Timewarp

_Information -_ Sets the rate at which time passes, normal is `1`. While the time warp button can only set the rate to `1`, `2`, or `5`, the command accepts any number.

_Parameters -_ A number to multiply the rate at which time passes. `1` resets to normal time.

_Syntax -_ `timewarp [rate]`

### Tutorial

_Information -_ Opens the tutorial.

_Syntax -_ `tutorial`

### Version

_Information -_ Displays the version of the game running.

Example: `Air Traffic Control simulator version 5.3.0`

_Syntax -_ `version`

