# Chips for Jesus — V5

- Removed the technical animation explanation under The prayer wall.
- Fixed rotating prayer previews: the old hover-to-pause behavior kept the wall frozen whenever the pointer rested over the container.
- Each of the three desktop prayer cards now rotates in order, one at a time, every 3.2 seconds (450ms fade).
- Mobile shows the first card, which updates every third tick.
- Reduced-motion users see stationary cards in accordance with their accessibility preference.
- No database migration needed.
