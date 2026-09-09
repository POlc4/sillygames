"""Dépendances transverses. Le générateur aléatoire est injecté pour être remplaçable en test."""

import random
from typing import Annotated

from fastapi import Depends


def get_rng() -> random.Random:
    return random.Random()


Rng = Annotated[random.Random, Depends(get_rng)]
