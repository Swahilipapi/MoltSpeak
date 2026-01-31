"""
MoltSpeak Python SDK
"""
from setuptools import setup, find_packages

setup(
    name="moltspeak",
    version="0.1.0",
    description="MoltSpeak Protocol SDK - Secure agent-to-agent communication",
    long_description=open("README.md").read() if __name__ != "__main__" else "",
    long_description_content_type="text/markdown",
    author="MoltSpeak Contributors",
    url="https://github.com/Swahilipapi/MoltSpeak",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        # Core dependencies only
    ],
    extras_require={
        "crypto": ["pynacl>=1.5.0"],  # For real cryptographic operations
        "dev": [
            "pytest>=7.0",
            "pytest-asyncio>=0.21",
            "black>=23.0",
            "mypy>=1.0",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Communications",
        "Topic :: Security :: Cryptography",
    ],
)
