### Initial Prompt
Please define a good "version 0" of the app described below, with basic scaffolding and framework and that allows clicking but has no complex interactions behind the scenes. Then create a stepwise plan for implementing that app, and then build it. Feel free to ask any questions for clarification, the first step is the most important to get right.



### V1 App description
I'm building a simple app for local community (working name: "Local Block").

The core idea: each neighborhood gets a private landing page (accessible only by knowing the community code ahead of time, by getting it from a neighbor) that serves as a "front door" to all their local resources—links to group chats, event calendars, contact info for organizers, etc.

This is an MVP to test the concept with real neighbors, so simplicity and maintainability are critical. I want clean abstractions that make it easy to iterate and add features later without breaking things.

We have two user personas (I'm not attached to the titles for these users):
* Community Admin (signed in)
* Public (not signed in)

Things that a Public user can do:
* Load the homepage
* Enter in a community code to go to a specific community (also reachable at `/<community-code>`) - we'd like these codes to only be discoverable by asking a neighbor directly.
* View content on the community page
* Sign-Up or Sign-In to unlock community creation or admin abilities.

Things an Admin user (someone who is signed in) can do:
* If they are not already an admin of a community, they can create a new community (use a modal for this)
* If they are an admin, they can manage their community page (maybe `/<community-code>/manage` ?) - edit the community's content (which should be a single markdown field), add new people as admins, or delete the community.

Any user should only be able to admin a single community.

Pages:
* Homepage (`/`) - lets start with just a "enter community code here" textbox that directs users towards `/<entered-community-code>`.
* Community page (`/<community-code>`) - has the community code at the top and community content (just text). For an admin of a community, also include a "Manage Community" button.
* Everything else (e.g. sign-in and community creation) should be modals

We want to approach this iteratively, adding minimal code and using clean abstractions that allow us to start building in more complex functionality later. For example: we should have something like a `get_community_content(community_code)` function that returns a string of the community content. Initially, the function can just have a hardcoded string, but can be replaced by a database call later.

We want to use very modern, but established, tools and patterns (e.g. Typescript). The intent is for this app to be very simple and easy to maintain. We will want the app to be open source.
