---
title: FAQ
description: Frequently asked questions about Avatio
image: /ogp.png
---

# FAQ

## What is Avatio?

Avatio is a service that allows you to list and share items used for modifying avatars in VR social platforms.
We uniquely call these combination lists of base avatars and items "**Setups**".

You can search and view setups created by other users, and jump directly to the product pages of base avatars and items.
You can also bookmark setups you like.

You can attach images to the setups you post.

Share your favorite avatars and items with other users!

---

## Setups

### Are there any restrictions on items that can be registered to a setup?

Basically, items unrelated to VR avatars cannot be registered.

Currently, the following items can be registered:

- BOOTH
    - Items in the **3D Models** and **Material Data** categories
    - Items with the **VRChat** tag
- GitHub
    - Public repositories

::warning
Items unrelated to the purpose of this service may be hidden.
::

### What should I do if the item I want to register has been deleted?

Items that have already been deleted or made private on the distribution/sales platform cannot be registered to Avatio.
This is designed to respect the intentions of item sellers who have deleted or made their items private. Please understand.

::note
Items that have been recently made private may still be registered. This is because Avatio caches item information independently.
After being made private, item information will become unavailable within a maximum of 24 hours.
::

---

## Users

### What are badges?

Badges are awarded to prove a user's achievements or status.

You can earn them by meeting certain conditions, such as contributing to the management and development of Avatio.

| Badge                                          | Name        | How to Obtain                                                                        |
| ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| :icon{name="fluent-color:building-store-24"}   | Shop Owner  | Open a store/shop and verify it on Avatio                                            |
| :icon{name="fluent-color:shield-24"}           | Patrol      | Have 5 or more reports on setups or users accepted (match pumping is subject to BAN) |
| :icon{name="fluent-color:animal-paw-print-24"} | Contributor | Become a contributor on GitHub                                                       |

There are several other badges, and more will be added in the future.

### What happens to the setups I posted if I delete my account?

If you delete your Avatio account, all data associated with the account (posted setups, account information, bookmarks, etc.) will be deleted.

Please note that once deleted, information cannot be restored.
We will not respond to any inquiries regarding the recovery of deleted data.

### Will there be ads or a monthly fee?

No, there won't be. Avatio is currently operated as a non-profit service, and there are no plans to display ads or create subscription plans.
If there are any changes to our operational policy in the future, we will notify users in advance.

---

## Sales

### What happens if I delete an item I'm selling?

If an item used in a setup posted on Avatio is deleted from the sales site, it will be displayed on Avatio as "an item whose information could not be retrieved."

The same applies if you close your store.

### Item/store information updates are not reflected in Avatio

It may take up to about 24 hours for item and store information to be reflected in Avatio.
If it's not reflected after 24 hours, please report it [here](https://github.com/liria24/avatio/issues).

---

## Management & Development

### How is item information retrieved?

#### BOOTH ([booth.pm](https://booth.pm))

BOOTH's official service does not provide an API for exchanging item and store information, so we retrieve information in the same way as normal web access.

To minimize the impact on BOOTH's official service due to temporary traffic increases or malicious attacks, we cache data in our own database.

Information obtained from BOOTH's official service will not be used for purposes other than Avatio or for commercial purposes.

#### GitHub ([github.com](https://github.com))

We use 🐙[ungh](https://github.com/unjs/ungh) to retrieve information from GitHub.

### Why is all of Avatio's source code publicly available?

Avatio is developed as open source to operate as a non-profit service.

The management and development of this service are carried out by a very small number of people, and we believe that the cooperation of our users is essential to improve the service.
For this purpose, we publish as much information as possible on [GitHub](https://github.com/liria24/avatio) and other platforms to provide as much information as possible.

### How can I contribute to development?

We sincerely appreciate your willingness to cooperate.

If you have ideas for improving the service, please create an Issue [here](https://github.com/liria24/avatio/issues).
Please feel free to report bugs, security risks, design issues, typos, and more.

::note
Please check in advance that a similar Issue has not already been created.
::

If you have web development skills, please send a PR.
We welcome contributions of all sizes and skill levels.

---

::callout
BOOTH is a registered trademark of pixiv Inc.
Avatio is not affiliated with pixiv Inc. or BOOTH.
::
