"""
MoltSpeak - Efficient agent-to-agent communication protocol
"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="moltspeak",
    version="0.1.0",
    author="MoltSpeak Contributors",
    author_email="hello@www.moltspeak.xyz",
    description="Efficient, secure agent-to-agent communication protocol",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://www.moltspeak.xyz",
    project_urls={
        "Documentation": "https://www.moltspeak.xyz/docs",
        "Source": "https://github.com/moltspeak/moltspeak",
        "Bug Tracker": "https://github.com/moltspeak/moltspeak/issues",
    },
    packages=find_packages(exclude=["tests", "tests.*"]),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Communications",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.9",
    install_requires=[
        # Core deps - keeping minimal
    ],
    extras_require={
        "crypto": ["pynacl>=1.5.0"],  # For Ed25519 signatures
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
        ],
    },
    keywords=[
        "ai",
        "agents", 
        "protocol",
        "communication",
        "llm",
        "claude",
        "gpt",
        "a2a",
    ],
)
