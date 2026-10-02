# To Manufacture

**Purpose:** get a part made by the person responsible for that machine.

- Submit a part with its files (STL, OBJ, 3MF, STEP, DXF, SVG, PDF) or an Onshape link, method, quantity, material and due date.
- Each **method** (FDM, resin, CNC, laser, outsourced, machine shop: editable in setup) maps to **positions** such as
  "3D Print Farm Manager". New jobs notify whoever holds them (mentors if nobody does).
- Pipeline board: Submitted > Queued > In progress > Done (Failed/Cancelled on a separate filter).
- Model files are gzip-compressed in the browser and **auto-deleted N days after the part is done** (default 14),
  unless the maker ticks "keep files". In-browser 3D preview for STL/OBJ/3MF.
- Requesters can edit or delete their own job while it's still "Submitted"; makers and mentors can manage everything.

**Not for:** buying parts (Purchase Requests), general to-dos (Tasks), storing CAD (Onshape link).

**Permissions:** submit (everyone), run each method's queue (its positions + Mentors), delete anything (Mentors).
