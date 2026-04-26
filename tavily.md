> ## Documentation Index
> Fetch the complete documentation index at: https://docs.tavily.com/llms.txt
> Use this file to discover all available pages before exploring further.

# About

> Welcome to Tavily!

<Note>
  Looking for a step-by-step tutorial to get started in under 5 minutes? Head to our [Quickstart guide](/guides/quickstart) and start coding!
</Note>

## Who are we?

We're a team of AI researchers and developers passionate about helping you build the next generation of AI assistants.
Our mission is to empower individuals and organizations with accurate, unbiased, and factual information.

## What is the Tavily Search Engine?

Building an AI agent that leverages realtime online information is not a simple task. Scraping doesn't scale and requires expertise to refine, current search engine APIs don't provide explicit information to queries but simply potential related articles (which are not always related), and are not very customziable for AI agent needs. This is why we're excited to introduce the first search engine for AI agents - [Tavily](https://app.tavily.com).

Tavily is a search engine optimized for LLMs, aimed at efficient, quick and persistent search results. Unlike other search APIs such as Serp or Google, Tavily focuses on optimizing search for AI developers and autonomous AI agents. We take care of all the burden of searching, scraping, filtering and extracting the most relevant information from online sources. All in a single API call!

To try the API in action, you can now use our hosted version on our [API Playground](https://app.tavily.com/playground).

<Info>
  If you're an AI developer looking to integrate your application with our API, or seek increased API limits, [please reach out!](mailto:support@tavily.com)
</Info>

## Why choose Tavily?

Tavily shines where others fail, with a Search API optimized for LLMs.

<AccordionGroup>
  <Accordion title="Purpose-Built">
    Tailored just for LLM Agents, we ensure the search results are optimized for <a href="https://towardsdatascience.com/retrieval-augmented-generation-intuitively-and-exhaustively-explain-6a39d6fe6fc9">RAG</a>. We take care of all the burden in searching, scraping, filtering and extracting information from online sources. All in a single API call! Simply pass the returned search results as context to your LLM.
  </Accordion>

  <Accordion title="Versatility">
    Beyond just fetching results, the Tavily Search API offers precision. With customizable search depths, domain management, and parsing HTML content controls, you're in the driver's seat.
  </Accordion>

  <Accordion title="Performance">
    Committed to speed and efficiency, our API guarantees real-time and trusted information. Our team works hard to improve Tavily's performance over time.
  </Accordion>

  <Accordion title="Integration-friendly">
    We appreciate the essence of adaptability. That's why integrating our API with your existing setup is a breeze. You can choose our [Python library](https://pypi.org/project/tavily-python/), [JavaScript package](https://www.npmjs.com/package/@tavily/core) or a simple API call. You can also use Tavily through any of our supported partners such as [LangChain](/integrations/langchain) and [LlamaIndex](/integrations/llamaindex).
  </Accordion>

  <Accordion title="Transparent & Informative">
    Our detailed documentation ensures you're never left in the dark. From setup basics to nuanced features, we've got you covered.
  </Accordion>
</AccordionGroup>

## How does the Search API work?

Traditional search APIs such as Google, Serp and Bing retrieve search results based on a user query. However, the results are sometimes irrelevant to the goal of the search, and return simple URLs and snippets of content which are not always relevant. Because of this, any developer would need to then scrape the sites to extract relevant content, filter irrelevant information, optimize the content to fit LLM context limits, and more. This task is a burden and requires a lot of time and effort to complete. The Tavily Search API takes care of all of this for you in a single API call.

The Tavily Search API aggregates up to 20 sites per a single API call, and uses proprietary AI to score, filter and rank the top most relevant sources and content to your task, query or goal.
In addition, Tavily allows developers to add custom fields such as context and limit response tokens to enable the optimal search experience for LLMs.

Tavily can also help your AI agent make better decisions by including a short answer for cross-agent communication.

<Tip>
  With LLM hallucinations, it's crucial to optimize for RAG with the right context and information. This is where Tavily comes in, delivering accurate and precise information for your RAG applications.
</Tip>

## Getting started

[Sign up](https://app.tavily.com) for Tavily to get your API key. You get **1,000 free API Credits every month**. No credit card required.

<Card icon="key" href="https://app.tavily.com" title="Get your free API key" horizontal>
  You get 1,000 free API Credits every month. **No credit card required.**
</Card>

Head to our [API Playground](https://app.tavily.com/playground) to familiarize yourself with our API.

To get started with Tavily's APIs and SDKs using code, head to our [Quickstart Guide](/guides/quickstart) and follow the steps.

<Note>
  Got questions? Stumbled upon an issue? Simply intrigued? Don't hesitate! Our support team is always on standby, eager to assist. Join us, dive deep, and redefine your search experience! [Contact us!](mailto:support@tavily.com)
</Note>

---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.tavily.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Start searching with Tavily in under 5 minutes.

## Get your free Tavily API key

Head to the [Tavily Platform](https://app.tavily.com) and sign in (or create an account). Then, copy one of your API keys from your dashboard.

<Card icon="key" href="https://app.tavily.com" title="Get your free API key" horizontal>
  You get 1,000 free API Credits every month. **No credit card required.**
</Card>

## Install Tavily

Install the Tavily SDK in your language of choice.

<CodeGroup>
  ```bash Python theme={null}
  pip install tavily-python
  ```

  ```bash JavaScript theme={null}
  npm i @tavily/core
  ```
</CodeGroup>

## Start searching with Tavily

Run your first Tavily Search in 4 lines of code. Simply replace the API key in this snippet with your own.

<CodeGroup>
  ```python Python theme={null}
  from tavily import TavilyClient

  tavily_client = TavilyClient(api_key="tvly-YOUR_API_KEY")
  response = tavily_client.search("Who is Leo Messi?")

  print(response)
  ```

  ```js JavaScript theme={null}
  const { tavily } = require("@tavily/core");

  const tvly = tavily({ apiKey: "tvly-YOUR_API_KEY" });
  const response = await tvly.search("Who is Leo Messi?");

  console.log(response);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.tavily.com/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer tvly-YOUR_API_KEY" \
    -d '{"query": "Who is Leo Messi?"}'
  ```
</CodeGroup>

## Next steps

That's all it takes to start using Tavily's basic features!

If you want to learn how to implement more complex workflows in Python, check out our intermediate-level [Getting Started notebook](https://colab.research.google.com/drive/1dWGtS3u4ocCLebuaa8Ivz7BkZ_40IgH1).

Or, dive deep into our API and read about the different parameters on our [API Reference](/documentation/api-reference/introduction) page, and learn how to integrate natively with one of our [SDKs](/sdk).

---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.tavily.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Introduction

> Easily integrate our APIs with your services.

## Base URL

The base URL for all requests to the Tavily API is:

```plaintext theme={null}
https://api.tavily.com
```

## Authentication

All Tavily endpoints are authenticated using API keys.
[Get your free API key](https://app.tavily.com).

```bash theme={null}
curl -X POST https://api.tavily.com/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tvly-YOUR_API_KEY" \
  -d '{"query": "Who is Leo Messi?"}'
```

## Endpoints

<CardGroup cols={2}>
  <Card icon="magnifying-glass" horizontal href="/documentation/api-reference/endpoint/search">
    **`/search`**

    Tavily's powerful web search API.
  </Card>

  <Card icon="file-lines" horizontal href="/documentation/api-reference/endpoint/extract">
    **`/extract`**

    Tavily's powerful content extraction API.
  </Card>

  <Card icon="circle-nodes" horizontal href="/documentation/api-reference/endpoint/crawl">
    `/crawl` , `/map`

    Tavily's intelligent sitegraph navigation and extraction tools.
  </Card>

  <Card icon="book" horizontal href="/documentation/api-reference/endpoint/research">
    **`/research`**

    Tavily's comprehensive research API for in-depth analysis.
  </Card>
</CardGroup>

## Project Tracking

You can optionally attach a Project ID to your API requests to organize and track usage by project. This is useful when a single API key is used across multiple projects or applications.

To attach a project to your request, add the `X-Project-ID` header:

```bash theme={null}
curl -X POST https://api.tavily.com/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tvly-YOUR_API_KEY" \
  -H "X-Project-ID: your-project-id" \
  -d '{"query": "Who is Leo Messi?"}'
```

**Key features:**

* An API key can be associated with multiple projects
* Filter requests by project in the [/logs endpoint](/documentation/api-reference/endpoint/usage) and platform usage dashboard
* Helps organize and track where requests originate from

<Note>
  When using the SDKs, you can specify a project using the `project_id`
  parameter when instantiating the client, or by setting the `TAVILY_PROJECT`
  environment variable.
</Note>

---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.tavily.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Tavily Search

> Execute a search query using Tavily Search.



## OpenAPI

````yaml POST /search
openapi: 3.0.3
info:
  title: Tavily Search and Extract API
  description: >-
    Our REST API provides seamless access to Tavily Search, a powerful search
    engine for LLM agents, and Tavily Extract, an advanced web scraping solution
    optimized for LLMs.
  version: 1.0.0
servers:
  - url: https://api.tavily.com/
security: []
tags:
  - name: Search
  - name: Extract
  - name: Crawl
  - name: Map
  - name: Research
  - name: Usage
paths:
  /search:
    post:
      summary: Search for data based on a query
      description: Execute a search query using Tavily Search.
      requestBody:
        description: Parameters for the Tavily Search request.
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                query:
                  type: string
                  description: The search query to execute with Tavily.
                  example: who is Leo Messi?
                search_depth:
                  type: string
                  description: >-
                    Controls the latency vs. relevance tradeoff and how
                    `results[].content` is generated:

                    - `advanced`: Highest relevance with increased latency. Best
                    for detailed, high-precision queries. Returns multiple
                    semantically relevant snippets per URL (configurable via
                    `chunks_per_source`).

                    - `basic`: A balanced option for relevance and latency.
                    Ideal for general-purpose searches. Returns one NLP summary
                    per URL.

                    - `fast`: Prioritizes lower latency while maintaining good
                    relevance. Returns multiple semantically relevant snippets
                    per URL (configurable via `chunks_per_source`).

                    - `ultra-fast`: Minimizes latency above all else. Best for
                    time-critical use cases. Returns one NLP summary per URL.


                    **Cost**:

                    - `basic`, `fast`, `ultra-fast`: 1 API Credit

                    - `advanced`: 2 API Credits


                    See [Search Best
                    Practices](/documentation/best-practices/best-practices-search#search-depth)
                    for guidance on choosing the right search depth.
                  enum:
                    - advanced
                    - basic
                    - fast
                    - ultra-fast
                  default: basic
                chunks_per_source:
                  type: integer
                  description: >-
                    Chunks are short content snippets (maximum 500 characters
                    each) pulled directly from the source. Use
                    `chunks_per_source` to define the maximum number of relevant
                    chunks returned per source and to control the `content`
                    length. Chunks will appear in the `content` field as:
                    `<chunk 1> [...] <chunk 2> [...] <chunk 3>`. Available only
                    when `search_depth` is `advanced`.
                  default: 3
                  minimum: 1
                  maximum: 3
                max_results:
                  type: integer
                  example: 1
                  description: The maximum number of search results to return.
                  default: 5
                  minimum: 0
                  maximum: 20
                topic:
                  type: string
                  description: >-
                    The category of the search.`news` is useful for retrieving
                    real-time updates, particularly about politics, sports, and
                    major current events covered by mainstream media sources.
                    `general` is for broader, more general-purpose searches that
                    may include a wide range of sources.
                  default: general
                  enum:
                    - general
                    - news
                    - finance
                time_range:
                  type: string
                  description: >-
                    The time range back from the current date to filter results
                    based on publish date or last updated date. Useful when
                    looking for sources that have published or updated data.
                  enum:
                    - day
                    - week
                    - month
                    - year
                    - d
                    - w
                    - m
                    - 'y'
                  default: null
                start_date:
                  type: string
                  description: >-
                    Will return all results after the specified start date based
                    on publish date or last updated date. Required to be written
                    in the format YYYY-MM-DD
                  example: '2025-02-09'
                  default: null
                end_date:
                  type: string
                  description: >-
                    Will return all results before the specified end date based
                    on publish date or last updated date. Required to be written
                    in the format YYYY-MM-DD
                  example: '2025-12-29'
                  default: null
                include_answer:
                  oneOf:
                    - type: boolean
                    - type: string
                      enum:
                        - basic
                        - advanced
                  description: >-
                    Include an LLM-generated answer to the provided query.
                    `basic` or `true` returns a quick answer. `advanced` returns
                    a more detailed answer.
                  default: false
                include_raw_content:
                  oneOf:
                    - type: boolean
                    - type: string
                      enum:
                        - markdown
                        - text
                  description: >-
                    Include the cleaned and parsed HTML content of each search
                    result. `markdown` or `true` returns search result content
                    in markdown format. `text` returns the plain text from the
                    results and may increase latency.
                  default: false
                include_images:
                  type: boolean
                  description: >-
                    Include images in the response. Returns both a top-level
                    `images` list of query-related images and an `images` array
                    inside each result object with images extracted from that
                    specific source.
                  default: false
                include_image_descriptions:
                  type: boolean
                  description: >-
                    When `include_images` is `true`, also add a descriptive text
                    for each image.
                  default: false
                include_favicon:
                  type: boolean
                  description: Whether to include the favicon URL for each result.
                  default: false
                include_domains:
                  type: array
                  description: >-
                    A list of domains to specifically include in the search
                    results. Maximum 300 domains.
                  items:
                    type: string
                  default: []
                exclude_domains:
                  type: array
                  description: >-
                    A list of domains to specifically exclude from the search
                    results. Maximum 150 domains.
                  items:
                    type: string
                  default: []
                country:
                  type: string
                  description: >-
                    Boost search results from a specific country. This will
                    prioritize content from the selected country in the search
                    results. Available only if topic is `general`.
                  enum:
                    - afghanistan
                    - albania
                    - algeria
                    - andorra
                    - angola
                    - argentina
                    - armenia
                    - australia
                    - austria
                    - azerbaijan
                    - bahamas
                    - bahrain
                    - bangladesh
                    - barbados
                    - belarus
                    - belgium
                    - belize
                    - benin
                    - bhutan
                    - bolivia
                    - bosnia and herzegovina
                    - botswana
                    - brazil
                    - brunei
                    - bulgaria
                    - burkina faso
                    - burundi
                    - cambodia
                    - cameroon
                    - canada
                    - cape verde
                    - central african republic
                    - chad
                    - chile
                    - china
                    - colombia
                    - comoros
                    - congo
                    - costa rica
                    - croatia
                    - cuba
                    - cyprus
                    - czech republic
                    - denmark
                    - djibouti
                    - dominican republic
                    - ecuador
                    - egypt
                    - el salvador
                    - equatorial guinea
                    - eritrea
                    - estonia
                    - ethiopia
                    - fiji
                    - finland
                    - france
                    - gabon
                    - gambia
                    - georgia
                    - germany
                    - ghana
                    - greece
                    - guatemala
                    - guinea
                    - haiti
                    - honduras
                    - hungary
                    - iceland
                    - india
                    - indonesia
                    - iran
                    - iraq
                    - ireland
                    - israel
                    - italy
                    - jamaica
                    - japan
                    - jordan
                    - kazakhstan
                    - kenya
                    - kuwait
                    - kyrgyzstan
                    - latvia
                    - lebanon
                    - lesotho
                    - liberia
                    - libya
                    - liechtenstein
                    - lithuania
                    - luxembourg
                    - madagascar
                    - malawi
                    - malaysia
                    - maldives
                    - mali
                    - malta
                    - mauritania
                    - mauritius
                    - mexico
                    - moldova
                    - monaco
                    - mongolia
                    - montenegro
                    - morocco
                    - mozambique
                    - myanmar
                    - namibia
                    - nepal
                    - netherlands
                    - new zealand
                    - nicaragua
                    - niger
                    - nigeria
                    - north korea
                    - north macedonia
                    - norway
                    - oman
                    - pakistan
                    - panama
                    - papua new guinea
                    - paraguay
                    - peru
                    - philippines
                    - poland
                    - portugal
                    - qatar
                    - romania
                    - russia
                    - rwanda
                    - saudi arabia
                    - senegal
                    - serbia
                    - singapore
                    - slovakia
                    - slovenia
                    - somalia
                    - south africa
                    - south korea
                    - south sudan
                    - spain
                    - sri lanka
                    - sudan
                    - sweden
                    - switzerland
                    - syria
                    - taiwan
                    - tajikistan
                    - tanzania
                    - thailand
                    - togo
                    - trinidad and tobago
                    - tunisia
                    - turkey
                    - turkmenistan
                    - uganda
                    - ukraine
                    - united arab emirates
                    - united kingdom
                    - united states
                    - uruguay
                    - uzbekistan
                    - venezuela
                    - vietnam
                    - yemen
                    - zambia
                    - zimbabwe
                  default: null
                auto_parameters:
                  type: boolean
                  description: >-
                    When `auto_parameters` is enabled, Tavily automatically
                    configures search parameters based on your query's content
                    and intent. You can still set other parameters manually, and
                    your explicit values will override the automatic ones. The
                    parameters `include_answer`, `include_raw_content`, and
                    `max_results` must always be set manually, as they directly
                    affect response size. Note: `search_depth` may be
                    automatically set to advanced when it's likely to improve
                    results. This uses 2 API credits per request. To avoid the
                    extra cost, you can explicitly set `search_depth` to
                    `basic`.
                  default: false
                exact_match:
                  type: boolean
                  description: >-
                    Ensure that only search results containing the exact quoted
                    phrase(s) in the query are returned, bypassing synonyms or
                    semantic variations. Wrap target phrases in quotes within
                    your query (e.g. `"John Smith" CEO Acme Corp`). Punctuation
                    is typically ignored inside quotes.
                  default: false
                include_usage:
                  type: boolean
                  description: Whether to include credit usage information in the response.
                  default: false
                safe_search:
                  type: boolean
                  description: |-
                    🔒 Enterprise only. 
                     whether to filter out adult or unsafe content from results. Not supported for `fast` or `ultra-fast` search depths.
                  default: false
              required:
                - query
      responses:
        '200':
          description: Search results returned successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  query:
                    type: string
                    description: The search query that was executed.
                    example: Who is Leo Messi?
                  answer:
                    type: string
                    description: >-
                      A short answer to the user's query, generated by an LLM.
                      Included in the response only if `include_answer` is
                      requested (i.e., set to `true`, `basic`, or `advanced`)
                    example: >-
                      Lionel Messi, born in 1987, is an Argentine footballer
                      widely regarded as one of the greatest players of his
                      generation. He spent the majority of his career playing
                      for FC Barcelona, where he won numerous domestic league
                      titles and UEFA Champions League titles. Messi is known
                      for his exceptional dribbling skills, vision, and
                      goal-scoring ability. He has won multiple FIFA Ballon d'Or
                      awards, numerous La Liga titles with Barcelona, and holds
                      the record for most goals scored in a calendar year. In
                      2014, he led Argentina to the World Cup final, and in
                      2015, he helped Barcelona capture another treble. Despite
                      turning 36 in June, Messi remains highly influential in
                      the sport.
                  images:
                    type: array
                    description: >-
                      A list of query-related images from image search. If
                      `include_image_descriptions` is true, each item will have
                      `url` and `description`. Note: per-result images are also
                      returned inside each result object's `images` field.
                    example: []
                    items:
                      type: object
                      properties:
                        url:
                          type: string
                        description:
                          type: string
                  results:
                    type: array
                    description: A list of sorted search results, ranked by relevancy.
                    items:
                      type: object
                      properties:
                        title:
                          type: string
                          description: The title of the search result.
                          example: Lionel Messi Facts | Britannica
                        url:
                          type: string
                          description: The URL of the search result.
                          example: https://www.britannica.com/facts/Lionel-Messi
                        content:
                          type: string
                          description: A short description of the search result.
                          example: >-
                            Lionel Messi, an Argentine footballer, is widely
                            regarded as one of the greatest football players of
                            his generation. Born in 1987, Messi spent the
                            majority of his career playing for Barcelona, where
                            he won numerous domestic league titles and UEFA
                            Champions League titles. Messi is known for his
                            exceptional dribbling skills, vision, and goal
                        score:
                          type: number
                          format: float
                          description: The relevance score of the search result.
                          example: 0.81025416
                        raw_content:
                          type: string
                          description: >-
                            The cleaned and parsed HTML content of the search
                            result. Only if `include_raw_content` is true.
                          example: null
                        favicon:
                          type: string
                          description: The favicon URL for the result.
                          example: https://britannica.com/favicon.png
                        images:
                          type: array
                          description: >-
                            A list of images extracted from this search result.
                            Only included when `include_images` is `true`. If
                            `include_image_descriptions` is `true`, each item
                            will have `url` and `description`.
                          items:
                            type: object
                            properties:
                              url:
                                type: string
                              description:
                                type: string
                  auto_parameters:
                    type: object
                    description: >-
                      A dictionary of the selected auto_parameters, only shown
                      when `auto_parameters` is true.
                    example:
                      topic: general
                      search_depth: basic
                  response_time:
                    type: number
                    format: float
                    description: Time in seconds it took to complete the request.
                    example: '1.67'
                  usage:
                    type: object
                    description: Credit usage details for the request.
                    example:
                      credits: 1
                  request_id:
                    type: string
                    description: >-
                      A unique request identifier you can share with customer
                      support to help resolve issues with specific requests.
                    example: 123e4567-e89b-12d3-a456-426614174111
                required:
                  - query
                  - results
                  - images
                  - response_time
                  - answer
        '400':
          description: Bad Request - Your request is invalid.
          content:
            application/json:
              schema:
                type: object
                properties:
                  detail:
                    type: object
                    properties:
                      error:
                        type: string
              example:
                detail:
                  error: >-
                    <400 Bad Request, (e.g Invalid topic. Must be 'general' or
                    'news'.)>
        '401':
          description: Unauthorized - Your API key is wrong or missing.
          content:
            application/json:
              schema:
                type: object
                properties:
                  detail:
                    type: object
                    properties:
                      error:
                        type: string
              example:
                detail:
                  error: 'Unauthorized: missing or invalid API key.'
        '429':
          description: Too many requests - Rate limit exceeded
          content:
            application/json:
              schema:
                type: object
                properties:
                  detail:
                    type: object
                    properties:
                      error:
                        type: string
              example:
                detail:
                  error: >-
                    Your request has been blocked due to excessive requests.
                    Please reduce rate of requests.
        '432':
          description: Key limit or Plan Limit exceeded
          content:
            application/json:
              schema:
                type: object
                properties:
                  detail:
                    type: object
                    properties:
                      error:
                        type: string
              example:
                detail:
                  error: >-
                    <432 Custom Forbidden Error (e.g This request exceeds your
                    plan's set usage limit. Please upgrade your plan or contact
                    support@tavily.com)>
        '433':
          description: PayGo limit exceeded
          content:
            application/json:
              schema:
                type: object
                properties:
                  detail:
                    type: object
                    properties:
                      error:
                        type: string
              example:
                detail:
                  error: >-
                    This request exceeds the pay-as-you-go limit. You can
                    increase your limit on the Tavily dashboard.
        '500':
          description: Internal Server Error - We had a problem with our server.
          content:
            application/json:
              schema:
                type: object
                properties:
                  detail:
                    type: object
                    properties:
                      error:
                        type: string
              example:
                detail:
                  error: Internal Server Error
      security:
        - bearerAuth: []
      x-codeSamples:
        - lang: python
          label: Python SDK
          source: |-
            from tavily import TavilyClient

            tavily_client = TavilyClient(api_key="tvly-YOUR_API_KEY")
            response = tavily_client.search("Who is Leo Messi?")

            print(response)
        - lang: javascript
          label: JavaScript SDK
          source: |-
            const { tavily } = require("@tavily/core");

            const tvly = tavily({ apiKey: "tvly-YOUR_API_KEY" });
            const response = await tvly.search("Who is Leo Messi?");

            console.log(response);
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: >-
        Bearer authentication header in the form Bearer <token>, where <token>
        is your Tavily API key (e.g., Bearer tvly-YOUR_API_KEY).

````