# RVM fitting partial render follow-up

Follow-up after PR #613: elbows and tees could still look partial because the first pass only corrected code-4 elbow arcs. This branch extends the post-model native fitting overlay with tangent end stubs for code-4 elbows and a complete bbox/axis tee overlay for synthetic TEE_COMPOSITE/TEE_BBOX_PLACEHOLDER objects.
