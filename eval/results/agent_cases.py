"""Thirty seeded score questions for the result-agent evaluation."""

_WORDS = [
    "Amber",
    "Boulder",
    "Comet",
    "Driftwood",
    "Elm",
    "Fjord",
    "Grove",
    "Helix",
    "Islet",
    "Junction",
    "Keystone",
    "Lantern",
    "Meteor",
    "Nectar",
    "Oasis",
    "Paragon",
    "Quill",
    "Raven",
    "Solstice",
    "Topaz",
    "Upland",
    "Vantage",
    "Wavelength",
    "Xyloid",
    "Yonder",
    "Zenith",
    "Atlas",
    "Brook",
    "Canyon",
    "Dahlia",
]

RESULT_AGENT_CASES = [
    {
        "jd_title": word,
        "score": 60 + index,
        "question": f"What is the {'latest ' if index == 0 else ''}match score for {word}?",
    }
    for index, word in enumerate(_WORDS)
]
