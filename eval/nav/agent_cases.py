"""Deterministic seeded-record subset for the agent navigation evaluation."""

_WORDS = [
    "Amber",
    "Birch",
    "Cobalt",
    "Delta",
    "Ember",
    "Falcon",
    "Granite",
    "Harbor",
    "Ivory",
    "Jasper",
    "Kestrel",
    "Lagoon",
    "Marble",
    "Nimbus",
    "Onyx",
    "Pioneer",
    "Quartz",
    "River",
    "Saffron",
    "Timber",
    "Umber",
    "Velvet",
    "Willow",
    "Xenon",
    "Yarrow",
    "Zephyr",
    "Acorn",
    "Beacon",
    "Cinder",
    "Dune",
    "Evergreen",
    "Frost",
    "Garnet",
    "Horizon",
    "Indigo",
    "Juniper",
    "Kingfisher",
    "Lumen",
    "Meadow",
    "Northstar",
]

NAV_AGENT_CASES = [
    {
        "query": f"{word} Backend",
        "expected_title": f"{word} Backend",
        "tool": "find_jd",
    }
    for word in _WORDS
]
