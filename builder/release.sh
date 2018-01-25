test -z $VERSION && echo "Environment VERSION is not set. You must set the version, eg. v0.0.2 to release" && exit 1

git add --all
git commit
git tag $VERSION
git push origin master --tags

