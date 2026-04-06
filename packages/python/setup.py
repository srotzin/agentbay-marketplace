from setuptools import setup, find_packages

setup(
    name="hiveagent-mcp",
    version="1.0.0",
    description="Connect to HiveAgent — 586 MCP tools across 22 industry verticals. The Amazon for AI agents.",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="HiveAgent",
    author_email="hello@hiveagentiq.com",
    url="https://hiveagentiq.com",
    project_urls={
        "Documentation": "https://hiveagentiq.com/docs",
        "Source": "https://github.com/hiveagentiq/hiveagent-python",
    },
    packages=find_packages(),
    install_requires=["httpx>=0.24.0"],
    extras_require={
        "langchain": ["langchain>=0.2.0", "langchain-core>=0.2.0"],
        "crewai": ["crewai>=0.1.0"],
    },
    python_requires=">=3.9",
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    keywords="mcp model-context-protocol ai agents langchain crewai tools",
)
