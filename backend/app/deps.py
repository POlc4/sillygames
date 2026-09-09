"""Dépendances transverses, injectées pour être remplaçables en test."""

import random
from collections.abc import Iterator
from typing import Annotated

import httpx
from fastapi import Depends


def get_rng() -> random.Random:
    return random.Random()


def get_http_client() -> Iterator[httpx.Client]:
    """Client HTTP sortant (fournisseurs OAuth). Les tests le remplacent par un MockTransport."""
    with httpx.Client(timeout=10.0) as client:
        yield client


Rng = Annotated[random.Random, Depends(get_rng)]
HttpClient = Annotated[httpx.Client, Depends(get_http_client)]
